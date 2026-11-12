import type { ActivityEvent, Approval, Finding, MemoryNote, Project, Task } from "../types";

/** Estado durable de la oficina. El estado de los agentes en vivo no se persiste. */
export interface PersistedState {
  projects: Project[];
  tasks: Task[];
  activity: ActivityEvent[];
  findings: Finding[];
  approvals: Approval[];
  memory: MemoryNote[];
}

export type Collection = keyof PersistedState;

export const COLLECTIONS: Collection[] = ["projects", "tasks", "activity", "findings", "approvals", "memory"];

export function emptyState(): PersistedState {
  return { projects: [], tasks: [], activity: [], findings: [], approvals: [], memory: [] };
}

/** Cambios pendientes de guardar, agrupados por colección. */
export type ChangeSet = { [K in Collection]?: PersistedState[K] };

export interface Repository {
  readonly kind: "supabase" | "archivo" | "memoria";
  load(): Promise<PersistedState>;
  /** Guarda (upsert) las filas modificadas. `full` es el estado completo por si el backend lo necesita. */
  save(changes: ChangeSet, full: PersistedState): Promise<void>;
}

/** Repositorio en memoria, útil para pruebas. */
export class MemoryRepository implements Repository {
  readonly kind = "memoria" as const;
  saved: PersistedState = emptyState();
  saves = 0;
  constructor(initial?: PersistedState) {
    if (initial) this.saved = structuredClone(initial);
  }
  async load() {
    return structuredClone(this.saved);
  }
  async save(_changes: ChangeSet, full: PersistedState) {
    this.saves++;
    this.saved = structuredClone(full);
  }
}
