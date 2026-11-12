"use client";

import { useState } from "react";
import { getAgent } from "@/lib/agents/roster";
import { postAction } from "@/lib/client/useOffice";
import { timeAgo } from "@/lib/client/labels";
import type { Approval, Project } from "@/lib/types";
import { Avatar } from "./common";

/** Acciones importantes que esperan autorización humana. */
export function ApprovalQueue({ approvals, projects }: { approvals: Approval[]; projects: Project[] }) {
  const pending = approvals.filter((a) => a.status === "pendiente");
  if (!pending.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        Requiere tu autorización ({pending.length})
      </h2>
      {pending.map((a) => (
        <ApprovalCard key={a.id} approval={a} project={projects.find((p) => p.id === a.projectId)} />
      ))}
    </section>
  );
}

function ApprovalCard({ approval, project }: { approval: Approval; project?: Project }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agent = getAgent(approval.agentId);

  async function resolve(approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      await postAction(`/api/approvals/${approval.id}`, { approved, note: note.trim() || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <Avatar id={approval.agentId} size={26} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">{approval.title}</p>
          <p className="text-[11px] text-zinc-500">
            {agent.name} · {approval.kind === "plan" ? "Plan de proyecto" : "Comando"} · {project?.title ?? approval.projectId} · {timeAgo(approval.createdAt)}
          </p>
        </div>
      </div>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 font-mono text-[11px] leading-relaxed text-zinc-800 ring-1 ring-zinc-200">
        {approval.detail}
      </pre>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota opcional (se envía al agente si rechazas)"
        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs outline-none focus:border-zinc-500"
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button disabled={busy} onClick={() => resolve(true)} className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          Autorizar
        </button>
        <button disabled={busy} onClick={() => resolve(false)} className="flex-1 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50">
          Rechazar
        </button>
      </div>
    </div>
  );
}
