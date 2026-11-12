"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { STATUS_META, usd } from "@/lib/client/labels";
import { useOffice } from "@/lib/client/useOffice";
import { AGENT_STATUSES, type AgentId } from "@/lib/types";
import { ActivityFeed } from "./panel/ActivityFeed";
import { ApprovalQueue } from "./panel/ApprovalQueue";
import { NewRequestForm } from "./panel/NewRequestForm";
import { Projects } from "./panel/Projects";
import { Team } from "./panel/Team";

const OfficeScene = dynamic(() => import("./office/OfficeScene").then((m) => m.OfficeScene), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-zinc-500">Construyendo la oficina…</div>,
});

type Tab = "proyectos" | "equipo" | "actividad";

export function Dashboard() {
  const { state, connection } = useOffice();
  const [tab, setTab] = useState<Tab>("proyectos");
  const [selected, setSelected] = useState<AgentId | null>(null);

  const stats = useMemo(() => {
    if (!state) return null;
    const counts = Object.fromEntries(AGENT_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const a of state.agents) counts[a.status]++;
    return {
      counts,
      active: state.projects.filter((p) => ["planificando", "esperando_aprobacion", "en_curso", "revisando"].includes(p.status)).length,
      done: state.tasks.filter((t) => t.status === "completada").length,
      cost: state.projects.reduce((s, p) => s + p.costUsd, 0),
      pending: state.approvals.filter((a) => a.status === "pendiente").length,
    };
  }, [state]);

  function select(id: AgentId | null) {
    setSelected(id);
    if (id) setTab("equipo");
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 grid-cols-2 gap-0.5 rounded-md bg-zinc-900 p-1" aria-hidden>
            <span className="rounded-sm bg-amber-400" />
            <span className="rounded-sm bg-sky-400" />
            <span className="rounded-sm bg-emerald-400" />
            <span className="rounded-sm bg-rose-400" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider">
              DATA LAB <span className="text-amber-500">AI</span>
            </h1>
            <p className="text-[11px] text-zinc-500">Oficina de agentes · Ingeniería de Datos, Ciencia de Datos, ML y BI</p>
          </div>
        </div>
        {state && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Chip ok={state.system.agentsEnabled} label={state.system.agentsEnabled ? `Agentes activos · ${state.system.model} · esfuerzo ${state.system.effort}` : "Agentes sin configurar"} />
            <Chip ok label={`Persistencia: ${state.system.persistence}`} />
            <Chip ok={connection === "conectado"} label={connection === "conectado" ? "En vivo" : connection === "conectando" ? "Conectando…" : "Desconectado"} />
          </div>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative h-[55vh] min-h-0 lg:h-auto lg:flex-1" aria-label="Oficina 3D">
          {state ? <OfficeScene agents={state.agents} selected={selected} onSelect={select} /> : <div className="flex h-full items-center justify-center text-sm text-zinc-500">Conectando con la oficina…</div>}
          {stats && (
            <>
              <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
                <Kpi label="Proyectos activos" value={String(stats.active)} />
                <Kpi label="Tareas completadas" value={String(stats.done)} />
                <Kpi label="Costo acumulado" value={usd(stats.cost)} />
                {stats.pending > 0 && <Kpi label="Autorizaciones" value={String(stats.pending)} alert />}
              </div>
              <ul className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5 rounded-xl bg-white/85 p-2 shadow backdrop-blur">
                {AGENT_STATUSES.map((s) => (
                  <li key={s} className="flex items-center gap-1 text-[11px] text-zinc-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].color }} />
                    {STATUS_META[s].label} <span className="font-semibold">{stats.counts[s]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <aside className="flex min-h-0 w-full flex-1 flex-col border-l border-zinc-200 bg-zinc-50 lg:w-[440px] lg:flex-none">
          {state && (
            <>
              <div className="space-y-3 overflow-y-auto p-3 empty:hidden" style={{ maxHeight: "45%" }}>
                <ApprovalQueue approvals={state.approvals} projects={state.projects} />
              </div>
              <nav className="flex border-b border-zinc-200 px-3" role="tablist">
                {(["proyectos", "equipo", "actividad"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`-mb-px border-b-2 px-3 py-2 text-xs font-semibold capitalize ${tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
                  >
                    {t}
                  </button>
                ))}
              </nav>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {tab === "proyectos" && (
                  <>
                    <NewRequestForm system={state.system} />
                    <Projects projects={state.projects} tasks={state.tasks} findings={state.findings} />
                  </>
                )}
                {tab === "equipo" && <Team agents={state.agents} tasks={state.tasks} selected={selected} onSelect={setSelected} />}
                {tab === "actividad" && <ActivityFeed activity={state.activity} />}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      {label}
    </span>
  );
}

function Kpi({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-1.5 shadow backdrop-blur ${alert ? "bg-red-600 text-white" : "bg-white/85"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${alert ? "text-red-100" : "text-zinc-500"}`}>{label}</p>
      <p className="text-base font-bold leading-tight">{value}</p>
    </div>
  );
}
