import type { AgentStatus, ProjectStatus, TaskStatus } from "../types";

export const STATUS_META: Record<AgentStatus, { label: string; color: string; symbol: string }> = {
  disponible: { label: "Disponible", color: "#10b981", symbol: "•" },
  trabajando: { label: "Trabajando", color: "#3b82f6", symbol: "⌨" },
  investigando: { label: "Investigando", color: "#a855f7", symbol: "?" },
  reunido: { label: "Reunido", color: "#f59e0b", symbol: "☰" },
  bloqueado: { label: "Bloqueado", color: "#ef4444", symbol: "!" },
  finalizado: { label: "Finalizado", color: "#14b8a6", symbol: "✓" },
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: string }> = {
  planificando: { label: "Planificando", tone: "bg-amber-100 text-amber-800" },
  esperando_aprobacion: { label: "Esperando aprobación", tone: "bg-orange-100 text-orange-800" },
  en_curso: { label: "En curso", tone: "bg-blue-100 text-blue-800" },
  revisando: { label: "Revisión del CEO", tone: "bg-violet-100 text-violet-800" },
  completado: { label: "Completado", tone: "bg-emerald-100 text-emerald-800" },
  fallido: { label: "Fallido", tone: "bg-red-100 text-red-800" },
  cancelado: { label: "Cancelado", tone: "bg-zinc-200 text-zinc-700" },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: string }> = {
  pendiente: { label: "Pendiente", tone: "bg-zinc-100 text-zinc-700" },
  en_curso: { label: "En curso", tone: "bg-blue-100 text-blue-800" },
  bloqueada: { label: "Esperando autorización", tone: "bg-red-100 text-red-800" },
  completada: { label: "Completada", tone: "bg-emerald-100 text-emerald-800" },
  fallida: { label: "Fallida", tone: "bg-red-100 text-red-800" },
  cancelada: { label: "Cancelada", tone: "bg-zinc-200 text-zinc-600" },
};

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es");
}

export function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}
