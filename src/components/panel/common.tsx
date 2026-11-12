"use client";

import { getAgent } from "@/lib/agents/roster";
import { STATUS_META } from "@/lib/client/labels";
import type { AgentId, AgentStatus } from "@/lib/types";

export function Avatar({ id, size = 28, status }: { id: AgentId; size?: number; status?: AgentStatus }) {
  const a = getAgent(id);
  const initials = a.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span className="relative inline-flex shrink-0" title={`${a.name} · ${a.role}`}>
      <span
        className="inline-flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white"
        style={{ width: size, height: size, background: a.look.torso, fontSize: size * 0.38 }}
      >
        {initials}
      </span>
      {status && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white"
          style={{ background: STATUS_META[status].color }}
        />
      )}
    </span>
  );
}

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>;
}

export function StatusPill({ status }: { status: AgentStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${m.color}1f`, color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function ProgressBar({ value, color = "#3b82f6" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">{children}</p>;
}
