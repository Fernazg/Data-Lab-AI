"use client";

import { useState } from "react";
import { getAgent } from "@/lib/agents/roster";
import { PROJECT_STATUS, TASK_STATUS, timeAgo, usd } from "@/lib/client/labels";
import { postAction } from "@/lib/client/useOffice";
import type { Finding, Project, Task } from "@/lib/types";
import { Avatar, Badge, Empty, ProgressBar } from "./common";
import { FilesDialog } from "./FilesDialog";

const ACTIVE = new Set(["planificando", "esperando_aprobacion", "en_curso", "revisando"]);

export function Projects({ projects, tasks, findings }: { projects: Project[]; tasks: Task[]; findings: Finding[] }) {
  if (!projects.length) return <Empty>Aún no hay proyectos. Envía una solicitud a la CEO para empezar.</Empty>;
  const sorted = [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-3">
      {sorted.map((p) => (
        <ProjectCard key={p.id} project={p} tasks={tasks.filter((t) => t.projectId === p.id)} findings={findings.filter((f) => f.projectId === p.id)} />
      ))}
    </div>
  );
}

function ProjectCard({ project, tasks, findings }: { project: Project; tasks: Task[]; findings: Finding[] }) {
  const [open, setOpen] = useState(ACTIVE.has(project.status));
  const [files, setFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const done = tasks.filter((t) => t.status === "completada").length;
  const progress = tasks.length ? tasks.reduce((s, t) => s + (t.status === "completada" ? 100 : t.progress), 0) / tasks.length : 0;
  const status = PROJECT_STATUS[project.status];

  async function cancel() {
    if (!window.confirm("¿Cancelar el proyecto? Se detendrán los agentes en curso.")) return;
    setBusy(true);
    try {
      await postAction(`/api/projects/${project.id}/cancel`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-3 text-left">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-zinc-900">{project.title}</h3>
          <Badge className={status.tone}>{status.label}</Badge>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500">
          <span>
            {done}/{tasks.length} tareas
          </span>
          <span>·</span>
          <span title="Costo estimado informado por el SDK">{usd(project.costUsd)}</span>
          <span>·</span>
          <span>{timeAgo(project.createdAt)}</span>
        </div>
        {tasks.length > 0 && (
          <div className="mt-2">
            <ProgressBar value={progress} color={project.status === "fallido" ? "#ef4444" : "#10b981"} />
          </div>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-100 p-3">
          <p className="whitespace-pre-wrap text-xs text-zinc-600">
            <span className="font-semibold text-zinc-800">Solicitud: </span>
            {project.request}
          </p>
          {project.planRationale && (
            <p className="whitespace-pre-wrap rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              <span className="font-semibold">Enfoque de la CEO: </span>
              {project.planRationale}
            </p>
          )}
          {project.status === "planificando" && <p className="animate-pulse text-xs text-zinc-500">La CEO está dividiendo el proyecto en tareas…</p>}

          <ol className="space-y-2">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} all={tasks} />
            ))}
          </ol>

          {findings.length > 0 && (
            <details className="rounded-lg bg-zinc-50 p-2 text-xs">
              <summary className="cursor-pointer font-semibold text-zinc-700">Hallazgos compartidos por el equipo ({findings.length})</summary>
              <ul className="mt-2 space-y-2">
                {findings.map((f) => (
                  <li key={f.id} className="flex gap-2">
                    <Avatar id={f.agentId} size={20} />
                    <div>
                      <p className="font-medium text-zinc-800">{f.topic}</p>
                      <p className="whitespace-pre-wrap text-zinc-600">{f.content}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {project.summary && (
            <div className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-950">
              <p className="mb-1 font-semibold">Revisión final de la CEO</p>
              <p className="whitespace-pre-wrap">{project.summary}</p>
            </div>
          )}
          {project.error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{project.error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setFiles(true)} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200">
              Ver entregables
            </button>
            {ACTIVE.has(project.status) && (
              <button disabled={busy} onClick={cancel} className="rounded-md px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
                Cancelar proyecto
              </button>
            )}
          </div>
        </div>
      )}
      {files && <FilesDialog projectId={project.id} title={project.title} onClose={() => setFiles(false)} />}
    </article>
  );
}

function TaskRow({ task, all }: { task: Task; all: Task[] }) {
  const agent = getAgent(task.assignee);
  const st = TASK_STATUS[task.status];
  const deps = task.dependsOn.map((d) => all.find((t) => t.id === d)?.title).filter(Boolean);
  const verified = task.result?.verifiedDeliverables ?? [];
  return (
    <li className="rounded-lg border border-zinc-100 p-2">
      <div className="flex items-start gap-2">
        <Avatar id={task.assignee} size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-zinc-900">{task.title}</p>
            <Badge className={st.tone}>{st.label}</Badge>
          </div>
          <p className="text-[11px] text-zinc-500">
            {agent.name} · {task.turns} turnos · {usd(task.costUsd)}
            {deps.length > 0 && <> · depende de: {deps.join(", ")}</>}
          </p>
          {(task.status === "en_curso" || task.status === "bloqueada") && (
            <div className="mt-1" title="Turnos usados respecto al máximo permitido">
              <ProgressBar value={task.progress} color={task.status === "bloqueada" ? "#ef4444" : "#3b82f6"} />
            </div>
          )}
          {task.result && (
            <details className="mt-1 text-[11px]">
              <summary className="cursor-pointer text-zinc-600">
                Resultado · {verified.filter((v) => v.exists).length}/{verified.length} entregables verificados en disco
              </summary>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700">{task.result.summary}</p>
              <ul className="mt-1 space-y-0.5 font-mono">
                {verified.map((v) => (
                  <li key={v.path} className={v.exists ? "text-emerald-700" : "text-red-700"}>
                    {v.exists ? "✓" : "✗"} {v.path} {v.exists ? `(${v.bytes} B)` : "— no existe"}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-zinc-500">
                <span className="font-medium">Cómo verificar:</span> {task.result.verification}
              </p>
            </details>
          )}
          {task.error && <p className="mt-1 text-[11px] text-red-700">{task.error}</p>}
        </div>
      </div>
    </li>
  );
}
