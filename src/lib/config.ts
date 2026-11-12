import "server-only";
import path from "node:path";

/** Configuración del servidor leída de variables de entorno. Nunca se envía al cliente tal cual. */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

export const config = {
  get anthropicConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.CLAUDE_CODE_OAUTH_TOKEN);
  },
  get model() {
    return process.env.AGENT_MODEL || "claude-opus-5-5";
  },
  get effort(): Effort {
    const e = process.env.AGENT_EFFORT as Effort | undefined;
    return e && EFFORTS.includes(e) ? e : "medium";
  },
  get maxBudgetUsd() {
    return num("AGENT_MAX_BUDGET_USD", 0.5);
  },
  get maxTurns() {
    return Math.floor(num("AGENT_MAX_TURNS", 16));
  },
  get maxConcurrency() {
    return Math.floor(num("AGENT_MAX_CONCURRENCY", 2));
  },
  get supabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return url && key ? { url, key } : null;
  },
  get adminToken() {
    return process.env.ADMIN_TOKEN || null;
  },
  get dataDir() {
    return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), ".data"));
  },
  get workspaceRoot() {
    return path.resolve(/*turbopackIgnore: true*/ process.env.WORKSPACE_DIR || path.join(process.cwd(), "workspace"));
  },
};
