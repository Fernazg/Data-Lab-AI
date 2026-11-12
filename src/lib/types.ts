/**
 * Tipos de dominio compartidos entre servidor y cliente.
 * Todo lo que viaja al navegador es serializable (sin funciones ni secretos).
 */

export type AgentId =
  | "ceo"
  | "data-engineer"
  | "data-architect"
  | "data-scientist"
  | "ml-engineer"
  | "data-analyst"
  | "bi-specialist"
  | "quality-auditor"
  | "tech-researcher";

/** Estados visibles de cada empleado. */
export type AgentStatus =
  | "disponible"
  | "trabajando"
  | "investigando"
  | "reunido"
  | "bloqueado"
  | "finalizado";

export const AGENT_STATUSES: AgentStatus[] = [
  "disponible",
  "trabajando",
  "investigando",
  "reunido",
  "bloqueado",
  "finalizado",
];

export type ProjectStatus =
  | "planificando" // el CEO está dividiendo el proyecto
  | "esperando_aprobacion" // el plan necesita el visto bueno humano
  | "en_curso"
  | "revisando" // el CEO revisa los resultados
  | "completado"
  | "fallido"
  | "cancelado";

export type TaskStatus =
  | "pendiente"
  | "en_curso"
  | "bloqueada"
  | "completada"
  | "fallida"
  | "cancelada";

export interface Project {
  id: string;
  title: string;
  request: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  /** Resumen final del CEO tras supervisar los resultados. */
  summary?: string;
  /** Razonamiento del plan propuesto por el CEO. */
  planRationale?: string;
  error?: string;
  /** Costo total estimado (USD) informado por el SDK. */
  costUsd: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assignee: AgentId;
  dependsOn: string[];
  status: TaskStatus;
  /** Avance 0–100 derivado de eventos reales (no inventado). */
  progress: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  result?: TaskResult;
  error?: string;
  costUsd: number;
  turns: number;
}

/** Informe estructurado que entrega cada agente al terminar. */
export interface TaskResult {
  summary: string;
  /** Rutas relativas al espacio de trabajo del proyecto. */
  deliverables: string[];
  /** Cómo puede comprobarse el resultado. */
  verification: string;
  /** Verificación automática: qué entregables existen realmente en disco. */
  verifiedDeliverables: { path: string; exists: boolean; bytes: number }[];
}

export type ActivityKind =
  | "sistema"
  | "proyecto"
  | "plan"
  | "tarea"
  | "herramienta"
  | "hallazgo"
  | "aprobacion"
  | "mensaje"
  | "error";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  agentId?: AgentId;
  projectId?: string;
  taskId?: string;
  message: string;
  /** Detalle técnico opcional (comando, ruta, etc.). */
  detail?: string;
}

/** Información compartida entre agentes de un mismo proyecto. */
export interface Finding {
  id: string;
  projectId: string;
  agentId: AgentId;
  topic: string;
  content: string;
  at: string;
}

export type ApprovalKind = "plan" | "herramienta";
export type ApprovalStatus = "pendiente" | "aprobada" | "rechazada" | "expirada";

export interface Approval {
  id: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  agentId: AgentId;
  projectId: string;
  taskId?: string;
  title: string;
  /** Lo que se va a ejecutar exactamente (comando, plan, etc.). */
  detail: string;
  createdAt: string;
  resolvedAt?: string;
  note?: string;
}

export interface AgentRuntime {
  id: AgentId;
  status: AgentStatus;
  currentTaskId?: string;
  /** Última acción real observada (herramienta usada, mensaje, etc.). */
  lastAction?: string;
  updatedAt: string;
  tasksCompleted: number;
}

/** Nota de memoria a largo plazo de un agente. */
export interface MemoryNote {
  id: string;
  agentId: AgentId;
  projectId: string;
  content: string;
  at: string;
}

export interface SystemInfo {
  agentsEnabled: boolean;
  /** Motivo por el que los agentes no pueden ejecutarse (sin clave, etc.). */
  agentsDisabledReason?: string;
  persistence: "supabase" | "archivo";
  model: string;
  effort: string;
  maxBudgetUsd: number;
  maxTurns: number;
  authRequired: boolean;
}

export interface OfficeSnapshot {
  system: SystemInfo;
  agents: AgentRuntime[];
  projects: Project[];
  tasks: Task[];
  activity: ActivityEvent[];
  findings: Finding[];
  approvals: Approval[];
}

/** Mensajes enviados por SSE al navegador. */
export type ServerEvent =
  | { type: "snapshot"; data: OfficeSnapshot }
  | { type: "agent"; data: AgentRuntime }
  | { type: "project"; data: Project }
  | { type: "task"; data: Task }
  | { type: "activity"; data: ActivityEvent }
  | { type: "finding"; data: Finding }
  | { type: "approval"; data: Approval };
