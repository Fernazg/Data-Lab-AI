import type { BuiltinTool } from "../agents/roster";
import type { AgentId } from "../types";

/**
 * Contrato entre el orquestador y el motor que ejecuta un agente.
 * En producción lo implementa `claudeExecutor` (Claude Agent SDK); en pruebas, un doble controlado.
 */
export interface AgentRunRequest {
  agentId: AgentId;
  projectId: string;
  taskId?: string;
  systemPrompt: string;
  prompt: string;
  /** Directorio de trabajo del proyecto (único lugar donde el agente puede leer/escribir). */
  cwd: string;
  tools: BuiltinTool[];
  /** JSON Schema de la respuesta final obligatoria. */
  outputSchema: Record<string, unknown>;
  maxTurns: number;
  signal: AbortSignal;
}

export type PermissionAnswer = { allow: true } | { allow: false; reason: string };

export interface AgentRunHooks {
  /** Decide si una llamada a herramienta puede ejecutarse (puede esperar aprobación humana). */
  canUseTool(toolName: string, input: Record<string, unknown>): Promise<PermissionAnswer>;
  onToolUse(toolName: string, input: Record<string, unknown>): void;
  onText(text: string): void;
  onTurn(turn: number): void;
  /** Herramientas de colaboración del equipo. */
  team: {
    share(topic: string, content: string): string;
    read(): string;
  };
}

export interface AgentRunResult {
  structured: unknown;
  text: string;
  costUsd: number;
  turns: number;
}

export type AgentExecutor = (request: AgentRunRequest, hooks: AgentRunHooks) => Promise<AgentRunResult>;

export class AgentRunError extends Error {
  constructor(
    message: string,
    readonly costUsd = 0,
    readonly turns = 0,
  ) {
    super(message);
    this.name = "AgentRunError";
  }
}
