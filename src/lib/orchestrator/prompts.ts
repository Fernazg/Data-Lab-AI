import { SPECIALISTS, getAgent } from "../agents/roster";
import type { Finding, MemoryNote, Task } from "../types";
import { MAX_PLAN_TASKS, type Plan } from "./schemas";

export function withMemory(instructions: string, memory: MemoryNote[]): string {
  if (memory.length === 0) return instructions;
  const notes = memory.map((m) => `- (${m.at.slice(0, 10)}) ${m.content}`).join("\n");
  return `${instructions}\n\nMemoria de tus proyectos anteriores (úsala solo si es relevante):\n${notes}`;
}

export function planPrompt(request: string): string {
  const team = SPECIALISTS.map((a) => `- ${a.id}: ${a.name}, ${a.role}. Especialidad: ${a.specialty}. Herramientas: ${a.tools.join(", ")}.`).join("\n");
  return `Nueva solicitud de un cliente:
"""
${request}
"""

Tu equipo disponible:
${team}

Divide la solicitud en entre 1 y ${MAX_PLAN_TASKS} tareas concretas, cada una con un entregable verificable (un archivo en el espacio de trabajo).
- Asigna cada tarea al especialista más adecuado (campo "responsable" con su id). Usa solo a quienes aporten valor: menos tareas es mejor si basta.
- Indica dependencias en "depende_de" con las claves de tareas previas cuyo resultado se necesita.
- Si hay entregables técnicos relevantes, incluye una tarea final de revisión para el auditor de calidad que dependa de ellas.
- La investigadora es la única con acceso web; asígnale investigación solo si hace falta información externa.
- No planifiques compras, contrataciones, despliegues en servicios de pago ni accesos a sistemas del cliente.
- En "razonamiento" explica brevemente el enfoque.
Responde solo con el plan estructurado.`;
}

export function formatPlan(plan: Plan): string {
  const lines = plan.tareas.map((t, i) => {
    const deps = t.depende_de.length ? ` (depende de: ${t.depende_de.join(", ")})` : "";
    return `${i + 1}. [${t.clave}] ${t.titulo} → ${getAgent(t.responsable).name} (${getAgent(t.responsable).role})${deps}\n   ${t.descripcion}`;
  });
  return `${plan.razonamiento}\n\n${lines.join("\n")}`;
}

export function taskPrompt(opts: { request: string; task: Task; dependencies: Task[]; projectTitle: string }): string {
  const deps = opts.dependencies
    .map((d) => {
      const r = d.result;
      const files = r?.verifiedDeliverables.filter((f) => f.exists).map((f) => f.path).join(", ") || "ninguno";
      return `### ${d.title} (${getAgent(d.assignee).name})\nResumen: ${r?.summary ?? "sin resumen"}\nArchivos: ${files}`;
    })
    .join("\n\n");
  return `Proyecto: ${opts.projectTitle}
Solicitud original del cliente (también en SOLICITUD.md):
"""
${opts.request}
"""

Tu tarea: ${opts.task.title}
${opts.task.description}
${deps ? `\nResultados previos del equipo de los que depende tu tarea:\n${deps}\n` : ""}
Instrucciones:
1. Consulta leer_hallazgos para ver lo que el equipo ya compartió.
2. Realiza la tarea y guarda tus entregables como archivos dentro del directorio actual (rutas relativas).
3. Comparte con compartir_hallazgo las decisiones que otros necesiten.
4. Termina con tu informe estructurado: "entregables" debe listar las rutas relativas de los archivos creados; "verificacion" explica cómo comprobar el resultado; "limitaciones" indica lo que no pudiste verificar.`;
}

export function reviewPrompt(opts: { request: string; title: string; tasks: Task[]; files: { path: string; bytes: number }[]; findings: Finding[] }): string {
  const tasks = opts.tasks
    .map((t) => {
      const head = `### ${t.title} — ${getAgent(t.assignee).name} — estado: ${t.status}`;
      if (!t.result) return `${head}\nError: ${t.error ?? "sin resultado"}`;
      const files = t.result.verifiedDeliverables.map((f) => `${f.path} (${f.exists ? `${f.bytes} bytes` : "NO EXISTE"})`).join(", ");
      return `${head}\nResumen: ${t.result.summary}\nEntregables verificados: ${files || "ninguno"}\nVerificación propuesta: ${t.result.verification}`;
    })
    .join("\n\n");
  const files = opts.files.map((f) => `- ${f.path} (${f.bytes} bytes)`).join("\n") || "(vacío)";
  return `Revisión final del proyecto "${opts.title}".
Solicitud del cliente:
"""
${opts.request}
"""

Resultados de las tareas:
${tasks}

Archivos presentes en el espacio de trabajo:
${files}

Hallazgos compartidos: ${opts.findings.length}

Supervisa los resultados: abre los entregables clave con Read para comprobar que existen y responden a la solicitud. No des por buenos archivos que no existan.
Responde con tu revisión estructurada: resumen ejecutivo para el cliente, si se cumplieron los objetivos y la lista de pendientes.`;
}

export function deriveTitle(request: string): string {
  const firstLine = request.trim().split("\n")[0] ?? "";
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine || "Nuevo proyecto";
}
