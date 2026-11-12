import { getAgent, type AgentProfile, type BuiltinTool } from "../agents/roster";
import type { AgentId, Project, Task } from "../types";
import type { ApprovalGate } from "./approvals";
import { AgentRunError, type AgentExecutor, type AgentRunResult } from "./executor";
import { decideTool, describeToolCall, statusForTool } from "./policy";
import { deriveTitle, formatPlan, planPrompt, reviewPrompt, taskPrompt, withMemory } from "./prompts";
import { jsonSchemaOf, planSchema, reviewSchema, validatePlan, workerReportSchema } from "./schemas";
import type { OfficeStore } from "./store";
import { ensureWorkspace, listWorkspace, verifyDeliverables } from "./workspace";

export interface OrchestratorOptions {
  store: OfficeStore;
  gate: ApprovalGate;
  executor: AgentExecutor;
  workspaceRoot: string;
  maxConcurrency: number;
  maxTurns: number;
  /** Tiempo que un agente permanece en "finalizado"/"bloqueado" antes de volver a "disponible". */
  lingerMs?: number;
}

const ACTIVE_PROJECT = new Set<Project["status"]>(["planificando", "esperando_aprobacion", "en_curso", "revisando"]);

/**
 * Coordina el trabajo: el CEO planifica, una persona aprueba, los especialistas ejecutan
 * respetando dependencias y concurrencia, y el CEO supervisa el resultado final.
 */
export class Orchestrator {
  private readonly store: OfficeStore;
  private readonly gate: ApprovalGate;
  private readonly executor: AgentExecutor;
  private readonly running = new Map<string, { controller: AbortController; agentId: AgentId; projectId: string }>();
  private readonly projectControllers = new Map<string, AbortController>();
  private readonly lingerTimers = new Map<AgentId, ReturnType<typeof setTimeout>>();
  /** Asistentes de cada reunión de arranque (por proyecto). */
  private readonly meetings = new Map<string, Set<AgentId>>();
  private readonly background = new Set<Promise<unknown>>();

  constructor(private readonly opts: OrchestratorOptions) {
    this.store = opts.store;
    this.gate = opts.gate;
    this.executor = opts.executor;
  }

  /** Espera a que termine todo el trabajo en segundo plano (útil en pruebas). */
  async idle(): Promise<void> {
    while (this.background.size) await Promise.allSettled([...this.background]);
  }

  private spawn(work: Promise<unknown>) {
    const p = work.catch((err) => console.error("[orquestador]", err)).finally(() => this.background.delete(p));
    this.background.add(p);
  }

  private workspaceDir(projectId: string) {
    return `${this.opts.workspaceRoot}/${projectId}`;
  }

  // ── API pública ───────────────────────────────────────────────

  /** Recibe una solicitud del cliente: crea el proyecto y el CEO empieza a planificar. */
  submit(request: string, title?: string): Project {
    const clean = request.trim();
    if (clean.length < 10) throw new Error("Describe la solicitud con al menos 10 caracteres.");
    const project = this.store.createProject(title?.trim() || deriveTitle(clean), clean);
    this.store.log({ kind: "proyecto", agentId: "ceo", projectId: project.id, message: `Nueva solicitud recibida: ${project.title}` });
    this.spawn(this.plan(project.id));
    return project;
  }

  /** Resuelve una aprobación desde el panel. */
  resolveApproval(id: string, approved: boolean, note?: string): boolean {
    return this.gate.resolve(id, approved, note);
  }

  /** Cancela un proyecto: aborta ejecuciones, expira aprobaciones y libera a los agentes. */
  cancel(projectId: string): void {
    const project = this.store.getProject(projectId);
    if (!project || !ACTIVE_PROJECT.has(project.status)) throw new Error("El proyecto no está activo.");
    this.store.updateProject(projectId, { status: "cancelado" });
    this.projectControllers.get(projectId)?.abort();
    for (const [, run] of this.running) if (run.projectId === projectId) run.controller.abort();
    this.gate.cancelProject(projectId, "Proyecto cancelado");
    for (const t of this.store.tasksOf(projectId)) {
      if (t.status === "pendiente" || t.status === "bloqueada") this.store.updateTask(t.id, { status: "cancelada" });
    }
    this.releaseMeeting(projectId);
    this.store.log({ kind: "proyecto", projectId, message: "Proyecto cancelado por el usuario" });
  }

  // ── Planificación (CEO) ───────────────────────────────────────

  private async plan(projectId: string): Promise<void> {
    const controller = new AbortController();
    this.projectControllers.set(projectId, controller);
    const project = this.store.getProject(projectId)!;
    try {
      const dir = await ensureWorkspace(this.opts.workspaceRoot, projectId, project.request);
      this.setStatus("ceo", "trabajando", "Analizando la solicitud y preparando el plan");
      this.store.log({ kind: "plan", agentId: "ceo", projectId, message: "Dividiendo el proyecto en tareas" });

      const result = await this.runAgent({
        agentId: "ceo",
        projectId,
        dir,
        tools: [],
        prompt: planPrompt(project.request),
        schema: jsonSchemaOf(planSchema),
        maxTurns: 4,
        signal: controller.signal,
      });
      const validation = validatePlan(result.structured);
      if (!validation.ok) throw new AgentRunError(validation.error, result.costUsd);
      if (this.store.getProject(projectId)?.status !== "planificando") return;

      const plan = validation.plan;
      const idByKey = new Map(plan.tareas.map((t, i) => [t.clave, `tsk_${projectId.slice(4)}_${i + 1}`]));
      for (const t of plan.tareas) {
        this.store.addTask({
          id: idByKey.get(t.clave),
          projectId,
          title: t.titulo,
          description: t.descripcion,
          assignee: t.responsable,
          dependsOn: t.depende_de.map((k) => idByKey.get(k)!),
        });
      }
      const title = project.title || plan.titulo_proyecto;
      this.store.updateProject(projectId, { status: "esperando_aprobacion", planRationale: plan.razonamiento, title });
      this.store.log({
        kind: "plan",
        agentId: "ceo",
        projectId,
        message: `Plan listo: ${plan.tareas.length} tareas para ${new Set(plan.tareas.map((t) => t.responsable)).size} especialistas`,
      });

      // Reunión de arranque mientras la persona revisa el plan.
      const attendees = new Set<AgentId>(["ceo", ...plan.tareas.map((t) => t.responsable)]);
      this.meetings.set(projectId, attendees);
      for (const id of attendees) {
        if (!this.isBusy(id)) this.setStatus(id, "reunido", `Reunión de arranque: ${title}`);
      }

      const { outcome } = this.gate.request(
        { kind: "plan", agentId: "ceo", projectId, title: `Aprobar plan: ${title}`, detail: formatPlan(plan) },
        controller.signal,
      );
      const answer = await outcome;
      this.releaseMeeting(projectId);
      if (this.store.getProject(projectId)?.status !== "esperando_aprobacion") return;

      if (!answer.approved) {
        for (const t of this.store.tasksOf(projectId)) this.store.updateTask(t.id, { status: "cancelada" });
        this.store.updateProject(projectId, { status: "cancelado", error: answer.note || "Plan rechazado" });
        this.store.log({ kind: "proyecto", projectId, message: "Plan rechazado: proyecto cancelado", detail: answer.note });
        return;
      }
      this.store.updateProject(projectId, { status: "en_curso" });
      this.store.log({ kind: "proyecto", agentId: "ceo", projectId, message: "Plan aprobado: el equipo comienza a trabajar" });
      this.pump();
    } catch (err) {
      this.failProject(projectId, err);
      this.releaseMeeting(projectId);
      this.setStatus("ceo", "bloqueado", "La planificación falló");
      this.linger("ceo");
    } finally {
      this.projectControllers.delete(projectId);
    }
  }

  // ── Planificador de tareas ────────────────────────────────────

  /** Arranca todas las tareas listas respetando dependencias, concurrencia y un trabajo por agente. */
  private pump(): void {
    for (const project of this.store.snapshotProjects()) {
      if (project.status !== "en_curso") continue;
      const tasks = this.store.tasksOf(project.id);
      const byId = new Map(tasks.map((t) => [t.id, t]));

      for (const t of tasks) {
        if (t.status !== "pendiente") continue;
        const broken = t.dependsOn.find((d) => ["fallida", "cancelada"].includes(byId.get(d)?.status ?? "fallida"));
        if (broken) {
          this.store.updateTask(t.id, { status: "fallida", error: `Dependencia no completada: ${byId.get(broken)?.title ?? broken}` });
          this.store.log({ kind: "tarea", agentId: t.assignee, projectId: project.id, taskId: t.id, message: `No puede empezar: ${t.title}`, detail: "Una dependencia falló" });
        }
      }

      for (const t of this.store.tasksOf(project.id)) {
        if (this.running.size >= this.opts.maxConcurrency) break;
        if (t.status !== "pendiente" || this.isBusy(t.assignee)) continue;
        if (!t.dependsOn.every((d) => byId.get(d)?.status === "completada")) continue;
        this.spawn(this.runTask(t));
      }

      const open = this.store.tasksOf(project.id).some((t) => ["pendiente", "en_curso", "bloqueada"].includes(t.status));
      if (!open) this.spawn(this.review(project.id));
    }
  }

  private async runTask(task: Task): Promise<void> {
    const controller = new AbortController();
    this.running.set(task.id, { controller, agentId: task.assignee, projectId: task.projectId });
    const agent = getAgent(task.assignee);
    const project = this.store.getProject(task.projectId)!;
    this.store.updateTask(task.id, { status: "en_curso", startedAt: new Date().toISOString(), progress: 0 });
    this.setStatus(task.assignee, "trabajando", `Comienza: ${task.title}`, task.id);
    this.store.log({ kind: "tarea", agentId: task.assignee, projectId: task.projectId, taskId: task.id, message: `Comienza la tarea: ${task.title}` });

    try {
      const dir = this.workspaceDir(task.projectId);
      const dependencies = task.dependsOn.map((id) => this.store.getTask(id)!).filter(Boolean);
      const result = await this.runAgent({
        agentId: task.assignee,
        projectId: task.projectId,
        taskId: task.id,
        dir,
        tools: agent.tools,
        prompt: taskPrompt({ request: project.request, task, dependencies, projectTitle: project.title }),
        schema: jsonSchemaOf(workerReportSchema),
        maxTurns: this.opts.maxTurns,
        signal: controller.signal,
      });
      const parsed = workerReportSchema.safeParse(result.structured);
      if (!parsed.success) throw new AgentRunError("Informe final con formato inválido", result.costUsd, result.turns);
      const report = parsed.data;
      const verified = await verifyDeliverables(dir, report.entregables);
      const existing = verified.filter((v) => v.exists).length;

      this.store.updateTask(task.id, {
        status: "completada",
        progress: 100,
        finishedAt: new Date().toISOString(),
        result: {
          summary: report.limitaciones ? `${report.resumen}\n\nLimitaciones: ${report.limitaciones}` : report.resumen,
          deliverables: report.entregables,
          verification: report.verificacion,
          verifiedDeliverables: verified,
        },
      });
      const runtime = this.store.getAgentRuntime(task.assignee);
      this.store.setAgent(task.assignee, { status: "finalizado", currentTaskId: undefined, lastAction: `Terminó: ${task.title}`, tasksCompleted: runtime.tasksCompleted + 1 });
      this.store.addMemory({ agentId: task.assignee, projectId: task.projectId, content: `${task.title}: ${report.resumen.slice(0, 300)}` });
      this.store.log({
        kind: "tarea",
        agentId: task.assignee,
        projectId: task.projectId,
        taskId: task.id,
        message: `Tarea completada: ${task.title}`,
        detail: `Entregables verificados en disco: ${existing}/${verified.length}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const cancelled = controller.signal.aborted;
      this.store.updateTask(task.id, { status: cancelled ? "cancelada" : "fallida", error: message, finishedAt: new Date().toISOString() });
      this.setStatus(task.assignee, cancelled ? "disponible" : "bloqueado", cancelled ? "Tarea cancelada" : `Error: ${message}`, undefined);
      this.store.log({ kind: cancelled ? "tarea" : "error", agentId: task.assignee, projectId: task.projectId, taskId: task.id, message: `${cancelled ? "Tarea cancelada" : "Tarea fallida"}: ${task.title}`, detail: message });
    } finally {
      this.running.delete(task.id);
      this.linger(task.assignee);
      this.pump();
    }
  }

  // ── Supervisión final (CEO) ───────────────────────────────────

  private async review(projectId: string): Promise<void> {
    const project = this.store.getProject(projectId);
    if (!project || project.status !== "en_curso") return;
    this.store.updateProject(projectId, { status: "revisando" });
    const tasks = this.store.tasksOf(projectId);
    const allDone = tasks.every((t) => t.status === "completada");

    if (!tasks.some((t) => t.status === "completada")) {
      this.store.updateProject(projectId, { status: "fallido", summary: "Ninguna tarea se completó; no hay resultados que revisar." });
      this.store.log({ kind: "proyecto", projectId, message: "Proyecto fallido: ninguna tarea completada" });
      return;
    }

    const controller = new AbortController();
    this.projectControllers.set(projectId, controller);
    this.setStatus("ceo", "trabajando", `Revisando resultados: ${project.title}`);
    this.store.log({ kind: "proyecto", agentId: "ceo", projectId, message: "Supervisando los entregables del equipo" });
    try {
      const dir = this.workspaceDir(projectId);
      const result = await this.runAgent({
        agentId: "ceo",
        projectId,
        dir,
        tools: ["Read", "Glob", "Grep"],
        prompt: reviewPrompt({ request: project.request, title: project.title, tasks, files: await listWorkspace(dir), findings: this.store.findingsOf(projectId) }),
        schema: jsonSchemaOf(reviewSchema),
        maxTurns: 10,
        signal: controller.signal,
      });
      const parsed = reviewSchema.safeParse(result.structured);
      if (!parsed.success) throw new AgentRunError("Revisión con formato inválido", result.costUsd);
      const review = parsed.data;
      const pending = review.pendientes.length ? `\n\nPendientes:\n${review.pendientes.map((p) => `- ${p}`).join("\n")}` : "";
      const ok = allDone && review.objetivos_cumplidos;
      if (this.store.getProject(projectId)?.status !== "revisando") return;
      this.store.updateProject(projectId, { status: ok ? "completado" : "fallido", summary: `${review.resumen_ejecutivo}${pending}` });
      this.store.addMemory({ agentId: "ceo", projectId, content: `${project.title}: ${review.resumen_ejecutivo.slice(0, 300)}` });
      this.setStatus("ceo", "finalizado", `Revisión terminada: ${project.title}`);
      this.store.log({ kind: "proyecto", agentId: "ceo", projectId, message: ok ? "Proyecto completado y verificado" : "Proyecto cerrado con pendientes", detail: review.pendientes.join(" · ") || undefined });
    } catch (err) {
      this.failProject(projectId, err);
      this.setStatus("ceo", "bloqueado", "La revisión falló");
    } finally {
      this.projectControllers.delete(projectId);
      this.linger("ceo");
    }
  }

  // ── Ejecución de un agente con permisos, estados y colaboración ──

  private async runAgent(opts: {
    agentId: AgentId;
    projectId: string;
    taskId?: string;
    dir: string;
    tools: BuiltinTool[];
    prompt: string;
    schema: Record<string, unknown>;
    maxTurns: number;
    signal: AbortSignal;
  }): Promise<AgentRunResult> {
    const profile: AgentProfile = { ...getAgent(opts.agentId), tools: opts.tools };
    const { agentId, projectId, taskId } = opts;
    const addCost = (usd: number, turns: number) => {
      this.store.addProjectCost(projectId, usd);
      if (taskId) {
        const t = this.store.getTask(taskId);
        if (t) this.store.updateTask(taskId, { costUsd: round(t.costUsd + usd), turns });
      }
    };

    try {
      const result = await this.executor(
        {
          agentId,
          projectId,
          taskId,
          systemPrompt: withMemory(profile.instructions, this.store.memoryOf(agentId)),
          prompt: opts.prompt,
          cwd: opts.dir,
          tools: opts.tools,
          outputSchema: opts.schema,
          maxTurns: opts.maxTurns,
          signal: opts.signal,
        },
        {
          canUseTool: async (toolName, input) => {
            const decision = decideTool(profile, toolName, input, opts.dir);
            if (decision.decision === "allow") return { allow: true };
            if (decision.decision === "deny") {
              this.store.log({ kind: "herramienta", agentId, projectId, taskId, message: `Acción denegada por la política: ${toolName}`, detail: decision.reason });
              return { allow: false, reason: decision.reason };
            }
            const previous = this.store.getAgentRuntime(agentId);
            this.setStatus(agentId, "bloqueado", `Esperando autorización: ${decision.title}`, previous.currentTaskId);
            if (taskId) this.store.updateTask(taskId, { status: "bloqueada" });
            const { outcome } = this.gate.request({ kind: "herramienta", agentId, projectId, taskId, title: decision.title, detail: decision.detail }, opts.signal);
            const answer = await outcome;
            if (taskId && this.store.getTask(taskId)?.status === "bloqueada") this.store.updateTask(taskId, { status: "en_curso" });
            this.setStatus(agentId, "trabajando", answer.approved ? "Autorización concedida" : "Autorización denegada", previous.currentTaskId);
            return answer.approved ? { allow: true } : { allow: false, reason: answer.note ? `Rechazado por la persona responsable: ${answer.note}` : "Rechazado por la persona responsable." };
          },
          onToolUse: (toolName, input) => {
            const { message, detail } = describeToolCall(toolName, input);
            const runtime = this.store.getAgentRuntime(agentId);
            if (runtime.status !== "bloqueado") this.setStatus(agentId, statusForTool(toolName), detail ? `${message}: ${detail}` : message, runtime.currentTaskId);
            this.store.log({ kind: "herramienta", agentId, projectId, taskId, message, detail });
          },
          onText: (text) => {
            const snippet = text.replace(/\s+/g, " ").trim();
            this.store.log({ kind: "mensaje", agentId, projectId, taskId, message: snippet.length > 220 ? `${snippet.slice(0, 220)}…` : snippet });
          },
          onTurn: (turn) => {
            if (taskId) this.store.updateTask(taskId, { turns: turn, progress: Math.min(95, Math.round((turn / opts.maxTurns) * 100)) });
          },
          team: {
            share: (topic, content) => {
              this.store.addFinding({ projectId, agentId, topic, content });
              this.store.log({ kind: "hallazgo", agentId, projectId, taskId, message: `Comparte: ${topic}` });
              return "Hallazgo registrado y visible para todo el equipo.";
            },
            read: () => {
              const items = this.store.findingsOf(projectId);
              if (!items.length) return "Todavía no hay hallazgos compartidos en este proyecto.";
              return items.map((f) => `[${getAgent(f.agentId).name} · ${getAgent(f.agentId).role}] ${f.topic}\n${f.content}`).join("\n\n---\n\n");
            },
          },
        },
      );
      addCost(result.costUsd, result.turns);
      return result;
    } catch (err) {
      if (err instanceof AgentRunError) addCost(err.costUsd, err.turns);
      throw err;
    }
  }

  // ── Utilidades de estado ──────────────────────────────────────

  private isBusy(agentId: AgentId): boolean {
    for (const run of this.running.values()) if (run.agentId === agentId) return true;
    return false;
  }

  private setStatus(agentId: AgentId, status: Parameters<OfficeStore["setAgent"]>[1]["status"], lastAction?: string, currentTaskId?: string) {
    const timer = this.lingerTimers.get(agentId);
    if (timer) clearTimeout(timer);
    this.lingerTimers.delete(agentId);
    this.store.setAgent(agentId, { status, lastAction, currentTaskId });
  }

  /** Tras terminar o fallar, el agente vuelve a "disponible" pasado un momento si no tiene trabajo. */
  private linger(agentId: AgentId) {
    const ms = this.opts.lingerMs ?? 8000;
    const timer = setTimeout(() => {
      this.lingerTimers.delete(agentId);
      const rt = this.store.getAgentRuntime(agentId);
      if (!this.isBusy(agentId) && (rt.status === "finalizado" || rt.status === "bloqueado")) {
        this.store.setAgent(agentId, { status: "disponible", currentTaskId: undefined });
      }
    }, ms);
    timer.unref?.();
    this.lingerTimers.set(agentId, timer);
  }

  /** Termina la reunión de un proyecto: sus asistentes vuelven a su puesto si no tienen otra reunión. */
  private releaseMeeting(projectId: string) {
    const attendees = this.meetings.get(projectId);
    if (!attendees) return;
    this.meetings.delete(projectId);
    for (const a of attendees) {
      const inOther = [...this.meetings.values()].some((m) => m.has(a));
      if (!inOther && this.store.getAgentRuntime(a).status === "reunido") {
        this.store.setAgent(a, { status: "disponible", lastAction: "Reunión terminada" });
      }
    }
  }

  private failProject(projectId: string, err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const project = this.store.getProject(projectId);
    if (!project || project.status === "cancelado") return;
    this.store.updateProject(projectId, { status: "fallido", error: message });
    for (const t of this.store.tasksOf(projectId)) {
      if (t.status === "pendiente" || t.status === "bloqueada") this.store.updateTask(t.id, { status: "cancelada" });
    }
    this.store.log({ kind: "error", agentId: "ceo", projectId, message: "El proyecto no pudo continuar", detail: message });
  }
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}
