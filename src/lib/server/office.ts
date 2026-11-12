import "server-only";
import { config } from "../config";
import { ApprovalGate } from "../orchestrator/approvals";
import { claudeExecutor } from "../orchestrator/claudeExecutor";
import { Orchestrator } from "../orchestrator/orchestrator";
import { OfficeStore } from "../orchestrator/store";
import { FileRepository } from "../persistence/fileRepository";
import type { Repository } from "../persistence/repository";
import { SupabaseRepository } from "../persistence/supabaseRepository";
import type { SystemInfo } from "../types";

interface Office {
  store: OfficeStore;
  orchestrator: Orchestrator;
  ready: Promise<void>;
}

const globalKey = Symbol.for("data-lab-ai.office");
type GlobalWithOffice = typeof globalThis & { [globalKey]?: Office };

function createRepository(): Repository {
  const sb = config.supabase;
  return sb ? new SupabaseRepository(sb.url, sb.key) : new FileRepository(config.dataDir);
}

/** Instancia única por proceso (sobrevive a la recarga en caliente en desarrollo). */
export function getOffice(): Office {
  const g = globalThis as GlobalWithOffice;
  if (!g[globalKey]) {
    const store = new OfficeStore(createRepository());
    const gate = new ApprovalGate(store);
    const orchestrator = new Orchestrator({
      store,
      gate,
      executor: claudeExecutor,
      workspaceRoot: config.workspaceRoot,
      maxConcurrency: config.maxConcurrency,
      maxTurns: config.maxTurns,
    });
    const ready = store.init().then(() => {
      store.log({ kind: "sistema", message: `Oficina iniciada · persistencia: ${store.repo.kind}` });
    });
    g[globalKey] = { store, orchestrator, ready };
  }
  return g[globalKey]!;
}

export function systemInfo(store: OfficeStore): SystemInfo {
  const enabled = config.anthropicConfigured;
  return {
    agentsEnabled: enabled,
    agentsDisabledReason: enabled ? undefined : "Falta ANTHROPIC_API_KEY en el servidor: los agentes no pueden ejecutarse.",
    persistence: store.repo.kind === "supabase" ? "supabase" : "archivo",
    model: config.model,
    effort: config.effort,
    maxBudgetUsd: config.maxBudgetUsd,
    maxTurns: config.maxTurns,
    authRequired: Boolean(config.adminToken),
  };
}
