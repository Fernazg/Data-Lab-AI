"use client";

import { AGENTS, DEPARTMENTS, getAgent } from "@/lib/agents/roster";
import { TASK_STATUS, timeAgo, usd } from "@/lib/client/labels";
import type { AgentId, AgentRuntime, Task } from "@/lib/types";
import { Avatar, Badge, StatusPill } from "./common";

export function Team({ agents, tasks, selected, onSelect }: { agents: AgentRuntime[]; tasks: Task[]; selected: AgentId | null; onSelect: (id: AgentId | null) => void }) {
  if (selected) {
    const rt = agents.find((a) => a.id === selected);
    if (rt) return <AgentDetail runtime={rt} tasks={tasks.filter((t) => t.assignee === selected)} onBack={() => onSelect(null)} />;
  }
  return (
    <ul className="space-y-1.5">
      {AGENTS.map((a) => {
        const rt = agents.find((r) => r.id === a.id);
        const task = rt?.currentTaskId ? tasks.find((t) => t.id === rt.currentTaskId) : undefined;
        return (
          <li key={a.id}>
            <button onClick={() => onSelect(a.id)} className="flex w-full items-start gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-left hover:border-zinc-400">
              <Avatar id={a.id} size={32} status={rt?.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-zinc-900">{a.name}</p>
                  {rt && <StatusPill status={rt.status} />}
                </div>
                <p className="text-[11px] text-zinc-500">{a.role}</p>
                {(task || rt?.lastAction) && <p className="mt-0.5 truncate text-[11px] text-zinc-600">{task ? `▸ ${task.title}` : rt?.lastAction}</p>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function AgentDetail({ runtime, tasks, onBack }: { runtime: AgentRuntime; tasks: Task[]; onBack: () => void }) {
  const a = getAgent(runtime.id);
  const dept = DEPARTMENTS.find((d) => d.id === a.department);
  const cost = tasks.reduce((s, t) => s + t.costUsd, 0);
  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-xs text-zinc-500 hover:text-zinc-900">
        ← Todo el equipo
      </button>
      <div className="flex items-center gap-3">
        <Avatar id={a.id} size={48} status={runtime.status} />
        <div>
          <p className="text-base font-semibold">{a.name}</p>
          <p className="text-xs text-zinc-500">
            {a.role} · {dept?.name}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={runtime.status} />
        <span className="text-[11px] text-zinc-500">desde {timeAgo(runtime.updatedAt)}</span>
      </div>
      {runtime.lastAction && <p className="rounded-lg bg-zinc-50 p-2 text-xs text-zinc-700">Última acción: {runtime.lastAction}</p>}

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Completadas" value={String(runtime.tasksCompleted)} />
        <Stat label="Tareas" value={String(tasks.length)} />
        <Stat label="Costo" value={usd(cost)} />
      </dl>

      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Especialidad</h3>
        <p className="text-xs text-zinc-700">{a.specialty}</p>
      </section>
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Herramientas</h3>
        <div className="flex flex-wrap gap-1">
          {a.tools.map((t) => (
            <Badge key={t} className={t === "Bash" ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-700"}>
              {t}
              {t === "Bash" && " (con autorización)"}
            </Badge>
          ))}
          <Badge className="bg-sky-50 text-sky-700">compartir_hallazgo</Badge>
          <Badge className="bg-sky-50 text-sky-700">leer_hallazgos</Badge>
        </div>
      </section>
      <details>
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-zinc-500">Instrucciones del agente</summary>
        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-[11px] text-zinc-700">{a.instructions}</pre>
      </details>
      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Historial de tareas</h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-zinc-500">Sin tareas asignadas todavía.</p>
        ) : (
          <ul className="space-y-1">
            {[...tasks].reverse().map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-zinc-100 px-2 py-1">
                <span className="truncate text-xs">{t.title}</span>
                <Badge className={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-2">
      <dt className="text-[10px] uppercase text-zinc-500">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}
