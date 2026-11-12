"use client";

import { useMemo, useState } from "react";
import { AGENTS, getAgent } from "@/lib/agents/roster";
import { timeAgo } from "@/lib/client/labels";
import type { ActivityEvent, ActivityKind, AgentId } from "@/lib/types";
import { Avatar, Empty } from "./common";

const KIND_STYLE: Record<ActivityKind, string> = {
  sistema: "text-zinc-500",
  proyecto: "text-zinc-900 font-medium",
  plan: "text-amber-800",
  tarea: "text-blue-800 font-medium",
  herramienta: "text-zinc-700",
  hallazgo: "text-sky-800",
  aprobacion: "text-red-800 font-medium",
  mensaje: "text-zinc-600 italic",
  error: "text-red-700 font-medium",
};

/** Registro de lo que realmente hacen los agentes (herramientas, mensajes, decisiones). */
export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  const [agent, setAgent] = useState<AgentId | "">("");
  const [hideMessages, setHideMessages] = useState(false);
  const items = useMemo(
    () => [...activity].reverse().filter((e) => (!agent || e.agentId === agent) && (!hideMessages || e.kind !== "mensaje")),
    [activity, agent, hideMessages],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select value={agent} onChange={(e) => setAgent(e.target.value as AgentId | "")} className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs">
          <option value="">Todo el equipo</option>
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.role}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-zinc-600">
          <input type="checkbox" checked={hideMessages} onChange={(e) => setHideMessages(e.target.checked)} />
          Ocultar mensajes
        </label>
      </div>
      {items.length === 0 ? (
        <Empty>Sin actividad todavía.</Empty>
      ) : (
        <ol className="space-y-1">
          {items.map((e) => (
            <li key={e.id} className="flex gap-2 rounded-md px-1 py-1 hover:bg-zinc-50">
              {e.agentId ? <Avatar id={e.agentId} size={20} /> : <span className="h-5 w-5 shrink-0 rounded-full bg-zinc-200" />}
              <div className="min-w-0 flex-1">
                <p className={`text-xs ${KIND_STYLE[e.kind]}`}>
                  {e.agentId && <span className="font-semibold not-italic text-zinc-900">{getAgent(e.agentId).name.split(" ")[0]}: </span>}
                  {e.message}
                </p>
                {e.detail && <p className="truncate font-mono text-[10px] text-zinc-500" title={e.detail}>{e.detail}</p>}
              </div>
              <time className="shrink-0 text-[10px] text-zinc-400" dateTime={e.at}>
                {timeAgo(e.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
