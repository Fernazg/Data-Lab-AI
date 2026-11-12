import { z } from "zod";
import { SPECIALISTS } from "../agents/roster";
import type { AgentId } from "../types";

/**
 * Esquemas de salida estructurada que el SDK exige a los agentes.
 * Se validan de nuevo con zod antes de usarlos: nunca se confía ciegamente en la salida del modelo.
 */

const SPECIALIST_IDS = SPECIALISTS.map((a) => a.id) as [AgentId, ...AgentId[]];

export const MAX_PLAN_TASKS = 8;

export const planSchema = z.object({
  titulo_proyecto: z.string().min(3).max(120),
  razonamiento: z.string().min(1).max(2000),
  tareas: z
    .array(
      z.object({
        clave: z.string().min(1).max(40),
        titulo: z.string().min(3).max(140),
        descripcion: z.string().min(10).max(2000),
        responsable: z.enum(SPECIALIST_IDS),
        depende_de: z.array(z.string()).max(MAX_PLAN_TASKS),
      }),
    )
    .min(1)
    .max(MAX_PLAN_TASKS),
});
export type Plan = z.infer<typeof planSchema>;

export const workerReportSchema = z.object({
  resumen: z.string().min(1).max(4000),
  entregables: z.array(z.string().min(1).max(300)).max(30),
  verificacion: z.string().min(1).max(2000),
  limitaciones: z.string().max(2000),
});
export type WorkerReport = z.infer<typeof workerReportSchema>;

export const reviewSchema = z.object({
  resumen_ejecutivo: z.string().min(1).max(4000),
  objetivos_cumplidos: z.boolean(),
  pendientes: z.array(z.string().max(500)).max(20),
});
export type Review = z.infer<typeof reviewSchema>;

/** JSON Schema para `outputFormat` del Agent SDK. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

export type PlanValidation = { ok: true; plan: Plan } | { ok: false; error: string };

/** Valida forma, claves únicas, dependencias existentes y ausencia de ciclos. */
export function validatePlan(raw: unknown): PlanValidation {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `Plan con formato inválido: ${parsed.error.issues[0]?.message ?? "desconocido"}` };
  const plan = parsed.data;
  const keys = new Set<string>();
  for (const t of plan.tareas) {
    if (keys.has(t.clave)) return { ok: false, error: `Clave de tarea duplicada: ${t.clave}` };
    keys.add(t.clave);
  }
  for (const t of plan.tareas) {
    for (const d of t.depende_de) {
      if (!keys.has(d)) return { ok: false, error: `La tarea ${t.clave} depende de una tarea inexistente: ${d}` };
      if (d === t.clave) return { ok: false, error: `La tarea ${t.clave} depende de sí misma` };
    }
  }
  // Detección de ciclos (orden topológico de Kahn).
  const indegree = new Map(plan.tareas.map((t) => [t.clave, t.depende_de.length]));
  const queue = plan.tareas.filter((t) => t.depende_de.length === 0).map((t) => t.clave);
  let visited = 0;
  while (queue.length) {
    const k = queue.shift()!;
    visited++;
    for (const t of plan.tareas) {
      if (t.depende_de.includes(k)) {
        indegree.set(t.clave, indegree.get(t.clave)! - 1);
        if (indegree.get(t.clave) === 0) queue.push(t.clave);
      }
    }
  }
  if (visited !== plan.tareas.length) return { ok: false, error: "El plan contiene dependencias circulares" };
  return { ok: true, plan };
}
