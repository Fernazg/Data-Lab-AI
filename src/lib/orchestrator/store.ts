import { randomUUID } from "node:crypto";
import { AGENTS } from "../agents/roster";
import type {
  ActivityEvent,
  AgentId,
  AgentRuntime,
  Approval,
  Finding,
  MemoryNote,
  OfficeSnapshot,
  Project,
  ServerEvent,
  SystemInfo,
  Task,
} from "../types";
import { emptyState, type ChangeSet, type Collection, type PersistedState, type Repository } from "../persistence/repository";

const MAX_ACTIVITY = 1000;
const SNAPSHOT_ACTIVITY = 200;

type Listener = (event: ServerEvent) => void;

export const now = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;

/**
 * Estado central de la oficina: única fuente de verdad del servidor.
 * Cada mutación emite un evento (para la interfaz en vivo) y se persiste de forma diferida.
 */
export class OfficeStore {
  private state: PersistedState = emptyState();
  private agents = new Map<AgentId, AgentRuntime>();
  private listeners = new Set<Listener>();
  private dirty = new Map<Collection, Map<string, unknown>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private ready: Promise<void> | null = null;
  persistError: string | null = null;

  constructor(
    readonly repo: Repository,
    private readonly opts: { persistDebounceMs?: number } = {},
  ) {
    for (const a of AGENTS) {
      this.agents.set(a.id, { id: a.id, status: "disponible", updatedAt: now(), tasksCompleted: 0 });
    }
  }

  /** Carga el estado persistido y marca como interrumpido lo que quedó a medias. */
  init(): Promise<void> {
    this.ready ??= (async () => {
      this.state = await this.repo.load();
      for (const a of AGENTS) {
        const done = this.state.tasks.filter((t) => t.assignee === a.id && t.status === "completada").length;
        this.agents.get(a.id)!.tasksCompleted = done;
      }
      const interrupted = "Interrumpido por reinicio del servidor";
      for (const t of this.state.tasks) {
        if (t.status === "en_curso" || t.status === "pendiente" || t.status === "bloqueada") {
          this.updateTask(t.id, { status: "fallida", error: interrupted });
        }
      }
      for (const p of this.state.projects) {
        if (["planificando", "esperando_aprobacion", "en_curso", "revisando"].includes(p.status)) {
          this.updateProject(p.id, { status: "fallido", error: interrupted });
        }
      }
      for (const ap of this.state.approvals) {
        if (ap.status === "pendiente") this.resolveApproval(ap.id, "expirada", interrupted);
      }
    })();
    return this.ready;
  }

  // ── Suscripción ───────────────────────────────────────────────
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ServerEvent) {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        // Un cliente desconectado no debe afectar al resto.
      }
    }
  }

  snapshot(system: SystemInfo): OfficeSnapshot {
    return structuredClone({
      system,
      agents: [...this.agents.values()],
      projects: this.state.projects,
      tasks: this.state.tasks,
      activity: this.state.activity.slice(-SNAPSHOT_ACTIVITY),
      findings: this.state.findings,
      approvals: this.state.approvals,
    });
  }

  // ── Persistencia diferida ─────────────────────────────────────
  private markDirty(collection: Collection, row: { id: string }) {
    let rows = this.dirty.get(collection);
    if (!rows) this.dirty.set(collection, (rows = new Map()));
    rows.set(row.id, row);
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => void this.flush(), this.opts.persistDebounceMs ?? 400);
  }

  /** Guarda inmediatamente los cambios pendientes. */
  flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.dirty.size === 0) return this.saving;
    const changes: ChangeSet = {};
    for (const [c, rows] of this.dirty) (changes[c] as unknown[]) = structuredClone([...rows.values()]);
    this.dirty.clear();
    const full = structuredClone(this.state);
    this.saving = this.saving
      .then(() => this.repo.save(changes, full))
      .then(() => {
        this.persistError = null;
      })
      .catch((err: unknown) => {
        this.persistError = err instanceof Error ? err.message : String(err);
        console.error("[persistencia]", this.persistError);
      });
    return this.saving;
  }

  // ── Agentes ───────────────────────────────────────────────────
  agentIds(): AgentId[] {
    return [...this.agents.keys()];
  }

  getAgentRuntime(id: AgentId): AgentRuntime {
    return structuredClone(this.agents.get(id)!);
  }

  setAgent(id: AgentId, patch: Partial<Omit<AgentRuntime, "id">>): AgentRuntime {
    const current = this.agents.get(id)!;
    const next: AgentRuntime = { ...current, ...patch, updatedAt: now() };
    if ("currentTaskId" in patch && patch.currentTaskId === undefined) delete next.currentTaskId;
    this.agents.set(id, next);
    this.emit({ type: "agent", data: structuredClone(next) });
    return next;
  }

  // ── Proyectos ─────────────────────────────────────────────────
  createProject(title: string, request: string): Project {
    const project: Project = {
      id: newId("prj"),
      title,
      request,
      status: "planificando",
      createdAt: now(),
      updatedAt: now(),
      costUsd: 0,
    };
    this.state.projects.push(project);
    this.markDirty("projects", project);
    this.emit({ type: "project", data: structuredClone(project) });
    return project;
  }

  /** Lista de proyectos (copia superficial para iterar con seguridad). */
  snapshotProjects(): Project[] {
    return [...this.state.projects];
  }

  getProject(id: string): Project | undefined {
    return this.state.projects.find((p) => p.id === id);
  }

  updateProject(id: string, patch: Partial<Omit<Project, "id">>): Project {
    const project = this.getProject(id);
    if (!project) throw new Error(`Proyecto no encontrado: ${id}`);
    Object.assign(project, patch, { updatedAt: now() });
    this.markDirty("projects", project);
    this.emit({ type: "project", data: structuredClone(project) });
    return project;
  }

  addProjectCost(id: string, usd: number) {
    const p = this.getProject(id);
    if (p && usd > 0) this.updateProject(id, { costUsd: round(p.costUsd + usd) });
  }

  // ── Tareas ────────────────────────────────────────────────────
  addTask(input: Pick<Task, "projectId" | "title" | "description" | "assignee" | "dependsOn"> & { id?: string }): Task {
    const task: Task = {
      id: input.id ?? newId("tsk"),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      assignee: input.assignee,
      dependsOn: input.dependsOn,
      status: "pendiente",
      progress: 0,
      createdAt: now(),
      updatedAt: now(),
      costUsd: 0,
      turns: 0,
    };
    this.state.tasks.push(task);
    this.markDirty("tasks", task);
    this.emit({ type: "task", data: structuredClone(task) });
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.state.tasks.find((t) => t.id === id);
  }

  tasksOf(projectId: string): Task[] {
    return this.state.tasks.filter((t) => t.projectId === projectId);
  }

  updateTask(id: string, patch: Partial<Omit<Task, "id">>): Task {
    const task = this.getTask(id);
    if (!task) throw new Error(`Tarea no encontrada: ${id}`);
    Object.assign(task, patch, { updatedAt: now() });
    this.markDirty("tasks", task);
    this.emit({ type: "task", data: structuredClone(task) });
    return task;
  }

  // ── Actividad ─────────────────────────────────────────────────
  log(event: Omit<ActivityEvent, "id" | "at">): ActivityEvent {
    const full: ActivityEvent = { id: newId("evt"), at: now(), ...event };
    this.state.activity.push(full);
    if (this.state.activity.length > MAX_ACTIVITY) this.state.activity.splice(0, this.state.activity.length - MAX_ACTIVITY);
    this.markDirty("activity", full);
    this.emit({ type: "activity", data: full });
    return full;
  }

  activityOf(projectId: string): ActivityEvent[] {
    return this.state.activity.filter((e) => e.projectId === projectId);
  }

  // ── Hallazgos compartidos ─────────────────────────────────────
  addFinding(input: Omit<Finding, "id" | "at">): Finding {
    const finding: Finding = { id: newId("fnd"), at: now(), ...input };
    this.state.findings.push(finding);
    this.markDirty("findings", finding);
    this.emit({ type: "finding", data: structuredClone(finding) });
    return finding;
  }

  findingsOf(projectId: string): Finding[] {
    return this.state.findings.filter((f) => f.projectId === projectId);
  }

  // ── Aprobaciones ──────────────────────────────────────────────
  addApproval(input: Omit<Approval, "id" | "createdAt" | "status">): Approval {
    const approval: Approval = { id: newId("apr"), createdAt: now(), status: "pendiente", ...input };
    this.state.approvals.push(approval);
    this.markDirty("approvals", approval);
    this.emit({ type: "approval", data: structuredClone(approval) });
    return approval;
  }

  getApproval(id: string): Approval | undefined {
    return this.state.approvals.find((a) => a.id === id);
  }

  resolveApproval(id: string, status: Exclude<Approval["status"], "pendiente">, note?: string): Approval {
    const approval = this.getApproval(id);
    if (!approval) throw new Error(`Aprobación no encontrada: ${id}`);
    Object.assign(approval, { status, note, resolvedAt: now() });
    this.markDirty("approvals", approval);
    this.emit({ type: "approval", data: structuredClone(approval) });
    return approval;
  }

  // ── Memoria a largo plazo ─────────────────────────────────────
  addMemory(input: Omit<MemoryNote, "id" | "at">): MemoryNote {
    const note: MemoryNote = { id: newId("mem"), at: now(), ...input };
    this.state.memory.push(note);
    this.markDirty("memory", note);
    return note;
  }

  /** Últimas notas de memoria de un agente (más recientes al final). */
  memoryOf(agentId: AgentId, limit = 5): MemoryNote[] {
    return this.state.memory.filter((m) => m.agentId === agentId).slice(-limit);
  }
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}
