import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovalGate } from "@/lib/orchestrator/approvals";
import { AgentRunError, type AgentExecutor } from "@/lib/orchestrator/executor";
import { Orchestrator } from "@/lib/orchestrator/orchestrator";
import { OfficeStore } from "@/lib/orchestrator/store";
import { MemoryRepository } from "@/lib/persistence/repository";
import type { AgentId } from "@/lib/types";

/**
 * Doble de pruebas del motor de agentes: NO se usa en la aplicación.
 * Permite verificar la coordinación sin llamar a la API.
 */
function fakeExecutor(opts: { plan?: unknown; failAgent?: AgentId; askBash?: AgentId; calls?: string[] } = {}): AgentExecutor {
  return async (req, hooks) => {
    opts.calls?.push(`${req.agentId}:${req.taskId ?? (req.tools.length ? "review" : "plan")}`);
    if (req.agentId === "ceo" && req.tools.length === 0) {
      return {
        structured: opts.plan ?? {
          titulo_proyecto: "Modelo de ventas",
          razonamiento: "Primero el modelo, luego la auditoría",
          tareas: [
            { clave: "modelo", titulo: "Diseñar modelo", descripcion: "Modelo dimensional de ventas", responsable: "data-architect", depende_de: [] },
            { clave: "etl", titulo: "Construir ETL", descripcion: "Pipeline de carga en Python", responsable: "data-engineer", depende_de: ["modelo"] },
            { clave: "qa", titulo: "Auditar", descripcion: "Revisión de calidad de los entregables", responsable: "quality-auditor", depende_de: ["modelo", "etl"] },
          ],
        },
        text: "",
        costUsd: 0.01,
        turns: 1,
      };
    }
    if (req.agentId === "ceo") {
      return { structured: { resumen_ejecutivo: "Todo verificado", objetivos_cumplidos: true, pendientes: [] }, text: "", costUsd: 0.02, turns: 2 };
    }
    if (req.agentId === opts.failAgent) throw new AgentRunError("fallo simulado", 0.005, 3);
    hooks.onTurn(1);
    hooks.onToolUse("Write", { file_path: `${req.agentId}.md` });
    if (req.agentId === opts.askBash) {
      const answer = await hooks.canUseTool("Bash", { command: "python etl.py", description: "Probar ETL" });
      if (!answer.allow) throw new AgentRunError(answer.reason);
    }
    await writeFile(path.join(req.cwd, `${req.agentId}.md`), `# ${req.agentId}\n`);
    expect(hooks.team.read()).toBeTypeOf("string");
    hooks.team.share(`Decisión de ${req.agentId}`, "contenido");
    return {
      structured: { resumen: `Hecho por ${req.agentId}`, entregables: [`${req.agentId}.md`, "no-existe.txt"], verificacion: "Abrir el archivo", limitaciones: "" },
      text: "",
      costUsd: 0.01,
      turns: 2,
    };
  };
}

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "datalab-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function setup(executor: AgentExecutor, repo = new MemoryRepository()) {
  const store = new OfficeStore(repo, { persistDebounceMs: 1 });
  await store.init();
  const gate = new ApprovalGate(store);
  const orchestrator = new Orchestrator({ store, gate, executor, workspaceRoot: root, maxConcurrency: 2, maxTurns: 10, lingerMs: 1 });
  return { store, orchestrator, repo };
}

async function until(cond: () => boolean, ms = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timeout esperando condición");
    await new Promise((r) => setTimeout(r, 5));
  }
}

const pendingApproval = (store: OfficeStore) => store.snapshot({} as never).approvals.find((a) => a.status === "pendiente");

describe("orquestador", () => {
  it("planifica, espera aprobación, respeta dependencias y supervisa", async () => {
    const calls: string[] = [];
    const { store, orchestrator, repo } = await setup(fakeExecutor({ calls }));
    const project = orchestrator.submit("Necesito un modelo de datos de ventas con ETL");

    await until(() => store.getProject(project.id)?.status === "esperando_aprobacion");
    // Reunión de arranque: CEO y asignados en la sala.
    expect(store.getAgentRuntime("ceo").status).toBe("reunido");
    expect(store.getAgentRuntime("data-engineer").status).toBe("reunido");
    expect(store.tasksOf(project.id).every((t) => t.status === "pendiente")).toBe(true);

    const approval = pendingApproval(store)!;
    expect(approval.kind).toBe("plan");
    expect(approval.detail).toContain("Diseñar modelo");
    orchestrator.resolveApproval(approval.id, true);

    await until(() => ["completado", "fallido"].includes(store.getProject(project.id)!.status));
    await orchestrator.idle();

    const p = store.getProject(project.id)!;
    expect(p.status).toBe("completado");
    expect(p.summary).toContain("Todo verificado");
    expect(p.costUsd).toBeCloseTo(0.06, 5);

    // Orden respetando dependencias
    const order = calls.filter((c) => !c.startsWith("ceo"));
    expect(order.map((c) => c.split(":")[0])).toEqual(["data-architect", "data-engineer", "quality-auditor"]);

    // Verificación real de entregables en disco
    const etl = store.tasksOf(project.id).find((t) => t.assignee === "data-engineer")!;
    expect(etl.result?.verifiedDeliverables).toEqual([
      { path: "data-engineer.md", exists: true, bytes: expect.any(Number) },
      { path: "no-existe.txt", exists: false, bytes: 0 },
    ]);
    expect(await readFile(path.join(root, project.id, "SOLICITUD.md"), "utf8")).toContain("modelo de datos");

    // Colaboración y memoria
    expect(store.findingsOf(project.id)).toHaveLength(3);
    expect(store.memoryOf("data-engineer")).toHaveLength(1);

    // Persistencia
    await store.flush();
    expect(repo.saved.projects[0].status).toBe("completado");
    expect(repo.saved.tasks).toHaveLength(3);
  });

  it("cancela el proyecto si se rechaza el plan", async () => {
    const { store, orchestrator } = await setup(fakeExecutor());
    const project = orchestrator.submit("Solicitud de prueba para rechazar");
    await until(() => !!pendingApproval(store));
    orchestrator.resolveApproval(pendingApproval(store)!.id, false, "No es prioritario");
    await orchestrator.idle();
    expect(store.getProject(project.id)?.status).toBe("cancelado");
    expect(store.tasksOf(project.id).every((t) => t.status === "cancelada")).toBe(true);
    expect(store.getAgentRuntime("data-architect").status).toBe("disponible");
  });

  it("pide autorización para comandos y bloquea al agente mientras espera", async () => {
    const plan = {
      titulo_proyecto: "ETL",
      razonamiento: "Solo ETL",
      tareas: [{ clave: "etl", titulo: "Construir ETL", descripcion: "Pipeline de carga en Python", responsable: "data-engineer", depende_de: [] }],
    };
    const { store, orchestrator } = await setup(fakeExecutor({ plan, askBash: "data-engineer" }));
    const project = orchestrator.submit("Construye un ETL sencillo en Python");
    await until(() => !!pendingApproval(store));
    orchestrator.resolveApproval(pendingApproval(store)!.id, true);

    await until(() => pendingApproval(store)?.kind === "herramienta");
    const bash = pendingApproval(store)!;
    expect(bash.detail).toBe("python etl.py");
    expect(store.getAgentRuntime("data-engineer").status).toBe("bloqueado");
    expect(store.tasksOf(project.id)[0].status).toBe("bloqueada");

    orchestrator.resolveApproval(bash.id, false, "No ejecutes nada");
    await until(() => ["completado", "fallido"].includes(store.getProject(project.id)!.status));
    await orchestrator.idle();
    const task = store.tasksOf(project.id)[0];
    expect(task.status).toBe("fallida");
    expect(task.error).toContain("No ejecutes nada");
    expect(store.getProject(project.id)?.status).toBe("fallido");
  });

  it("propaga fallos a las tareas dependientes", async () => {
    const { store, orchestrator } = await setup(fakeExecutor({ failAgent: "data-architect" }));
    const project = orchestrator.submit("Modelo de ventas que fallará en el diseño");
    await until(() => !!pendingApproval(store));
    orchestrator.resolveApproval(pendingApproval(store)!.id, true);
    await until(() => ["completado", "fallido"].includes(store.getProject(project.id)!.status));
    await orchestrator.idle();
    const statuses = store.tasksOf(project.id).map((t) => t.status);
    expect(statuses).toEqual(["fallida", "fallida", "fallida"]);
    expect(store.getProject(project.id)?.status).toBe("fallido");
  });

  it("marca como interrumpido el trabajo pendiente al reiniciar", async () => {
    const repo = new MemoryRepository();
    const first = await setup(fakeExecutor(), repo);
    const project = first.orchestrator.submit("Proyecto que quedará a medias");
    await until(() => !!pendingApproval(first.store));
    await first.store.flush();

    const second = await setup(fakeExecutor(), repo);
    expect(second.store.getProject(project.id)?.status).toBe("fallido");
    expect(second.store.getProject(project.id)?.error).toContain("reinicio");
    expect(second.store.snapshot({} as never).approvals[0].status).toBe("expirada");
    first.orchestrator.cancel(project.id);
  });

  it("rechaza solicitudes vacías", async () => {
    const { orchestrator } = await setup(fakeExecutor());
    expect(() => orchestrator.submit("corto")).toThrow();
  });
});
