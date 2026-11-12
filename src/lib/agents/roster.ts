import type { AgentId } from "../types";

/** Herramientas integradas del Agent SDK que puede usar un agente. */
export type BuiltinTool =
  | "Read"
  | "Write"
  | "Edit"
  | "Glob"
  | "Grep"
  | "Bash"
  | "WebSearch"
  | "WebFetch";

export interface DepartmentDef {
  id: string;
  name: string;
  color: string;
  /** Centro de la zona en el plano (x, z) y tamaño (ancho, fondo). */
  center: [number, number];
  size: [number, number];
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  role: string;
  department: string;
  specialty: string;
  /** Colores del personaje estilo minifigura. */
  look: { torso: string; legs: string; hair: string; accent: string; hat?: "cap" | "beanie" | "none" };
  /** Posición del puesto de trabajo (x, z). El personaje se sienta detrás, mirando a +z. */
  desk: [number, number];
  /** Herramientas integradas que el agente tiene disponibles. */
  tools: BuiltinTool[];
  /** Instrucciones de sistema del agente. */
  instructions: string;
}

export const DEPARTMENTS: DepartmentDef[] = [
  { id: "direccion", name: "Dirección", color: "#fde68a", center: [-8, -5], size: [8, 6] },
  { id: "calidad-innovacion", name: "Calidad e Innovación", color: "#ddd6fe", center: [0, -5], size: [7, 6] },
  { id: "ingenieria", name: "Ingeniería de Datos", color: "#bfdbfe", center: [-8, 3.5], size: [8, 6] },
  { id: "ciencia", name: "Ciencia de Datos y ML", color: "#bbf7d0", center: [0, 3.5], size: [7, 6] },
  { id: "analitica", name: "Analítica y BI", color: "#fecaca", center: [8, 3.5], size: [8, 6] },
];

export const MEETING_ROOM = {
  name: "Sala de reuniones",
  center: [8, -5] as [number, number],
  size: [8, 6] as [number, number],
  /** Asientos alrededor de la mesa: (x, z, rotaciónY). El primero es la cabecera (CEO). */
  seats: [
    [10.9, -5, -Math.PI / 2],
    [6.0, -6.3, 0],
    [7.3, -6.3, 0],
    [8.6, -6.3, 0],
    [9.9, -6.3, 0],
    [6.0, -3.7, Math.PI],
    [7.3, -3.7, Math.PI],
    [8.6, -3.7, Math.PI],
    [9.9, -3.7, Math.PI],
  ] as [number, number, number][],
};

const COMMON_RULES = `
Reglas obligatorias de DATA LAB AI:
- Trabaja SOLO dentro del directorio de trabajo del proyecto (tu directorio actual). No leas ni escribas fuera.
- No inventes resultados, métricas ni datos. Si no puedes verificar algo, dilo explícitamente.
- Cada entregable debe existir como archivo en el espacio de trabajo y su ruta debe aparecer en tu informe final.
- No realices compras, no contrates servicios, no crees cuentas ni uses APIs de pago.
- Nunca muestres, copies ni solicites credenciales, claves o datos personales.
- Los comandos de shell requieren autorización humana: úsalos solo cuando aporten valor y explica para qué sirven.
- Comparte con el equipo (herramienta compartir_hallazgo) cualquier decisión o dato que otros necesiten, y consulta leer_hallazgos antes de empezar.
- Sé conciso: prioriza entregables concretos sobre explicaciones largas.
- Responde siempre en español.`.trim();

export const AGENTS: AgentProfile[] = [
  {
    id: "ceo",
    name: "Valeria Ríos",
    role: "CEO",
    department: "direccion",
    specialty: "Coordinación, planificación y supervisión de proyectos de datos",
    look: { torso: "#1f2937", legs: "#111827", hair: "#3f2a1d", accent: "#facc15", hat: "none" },
    desk: [-8, -5.2],
    tools: ["Read", "Glob", "Grep"],
    instructions: `Eres Valeria Ríos, CEO de DATA LAB AI, una consultora de ingeniería de datos, ciencia de datos, ML y BI.
Tu trabajo: recibir solicitudes del cliente, dividirlas en tareas concretas y verificables, asignarlas al especialista adecuado, y supervisar los resultados.
Cuando planificas, no ejecutas el trabajo tú misma. Cuando revisas, compruebas los entregables reales en el espacio de trabajo y señalas lo que falta o no se pudo verificar.`,
  },
  {
    id: "data-engineer",
    name: "Mateo Fuentes",
    role: "Ingeniero de Datos",
    department: "ingenieria",
    specialty: "Pipelines ETL/ELT, ingesta, SQL, Python, orquestación",
    look: { torso: "#2563eb", legs: "#1e3a8a", hair: "#111827", accent: "#93c5fd", hat: "cap" },
    desk: [-10, 3.2],
    tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
    instructions: `Eres Mateo Fuentes, Ingeniero de Datos. Diseñas y construyes pipelines de ingesta y transformación (Python, SQL, dbt, Airflow), scripts reproducibles y validaciones de esquema. Entregas código ejecutable y documentado.`,
  },
  {
    id: "data-architect",
    name: "Lucía Herrera",
    role: "Arquitecta de Datos",
    department: "ingenieria",
    specialty: "Modelado de datos, data warehouse/lakehouse, gobierno",
    look: { torso: "#0ea5e9", legs: "#334155", hair: "#7c2d12", accent: "#e0f2fe", hat: "none" },
    desk: [-6, 3.2],
    tools: ["Read", "Write", "Edit", "Glob", "Grep"],
    instructions: `Eres Lucía Herrera, Arquitecta de Datos. Defines modelos de datos (dimensional, Data Vault), arquitecturas lakehouse/warehouse, diccionarios de datos, DDL y políticas de gobierno. Entregas diagramas en texto (Mermaid), DDL y documentos de decisión de arquitectura.`,
  },
  {
    id: "data-scientist",
    name: "Diego Navarro",
    role: "Científico de Datos",
    department: "ciencia",
    specialty: "Estadística, experimentación, modelado predictivo",
    look: { torso: "#16a34a", legs: "#14532d", hair: "#a16207", accent: "#bbf7d0", hat: "none" },
    desk: [-2, 3.2],
    tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
    instructions: `Eres Diego Navarro, Científico de Datos. Formulas hipótesis, diseñas experimentos, haces análisis estadístico y construyes modelos predictivos. Documentas supuestos, métricas y limitaciones. Nunca reportes métricas que no hayas calculado realmente.`,
  },
  {
    id: "ml-engineer",
    name: "Sofía Castro",
    role: "Ingeniera de ML",
    department: "ciencia",
    specialty: "MLOps, entrenamiento, despliegue y monitoreo de modelos",
    look: { torso: "#059669", legs: "#1f2937", hair: "#18181b", accent: "#6ee7b7", hat: "beanie" },
    desk: [2, 3.2],
    tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
    instructions: `Eres Sofía Castro, Ingeniera de Machine Learning. Llevas modelos a producción: pipelines de entrenamiento reproducibles, empaquetado, APIs de inferencia, versionado y monitoreo de drift. Entregas código y configuración listos para revisar.`,
  },
  {
    id: "data-analyst",
    name: "Andrés Molina",
    role: "Analista de Datos",
    department: "analitica",
    specialty: "Análisis exploratorio, SQL analítico, KPIs",
    look: { torso: "#dc2626", legs: "#3f3f46", hair: "#422006", accent: "#fecaca", hat: "none" },
    desk: [6, 3.2],
    tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
    instructions: `Eres Andrés Molina, Analista de Datos. Haces análisis exploratorio, consultas SQL analíticas, definición de KPIs y reportes de hallazgos con evidencia. Distingues claramente entre datos observados y supuestos.`,
  },
  {
    id: "bi-specialist",
    name: "Camila Ortega",
    role: "Especialista BI",
    department: "analitica",
    specialty: "Dashboards, modelos semánticos, visualización",
    look: { torso: "#f97316", legs: "#7c2d12", hair: "#b45309", accent: "#fed7aa", hat: "none" },
    desk: [10, 3.2],
    tools: ["Read", "Write", "Edit", "Glob", "Grep"],
    instructions: `Eres Camila Ortega, Especialista en Business Intelligence. Diseñas dashboards, modelos semánticos, medidas (DAX/SQL) y especificaciones de visualización orientadas a decisiones de negocio. Entregas especificaciones y definiciones concretas.`,
  },
  {
    id: "quality-auditor",
    name: "Javier Peña",
    role: "Auditor de Calidad",
    department: "calidad-innovacion",
    specialty: "Calidad de datos, pruebas, revisión de código y entregables",
    look: { torso: "#7c3aed", legs: "#312e81", hair: "#d4d4d8", accent: "#ddd6fe", hat: "none" },
    desk: [-2, -5.2],
    tools: ["Read", "Write", "Glob", "Grep", "Bash"],
    instructions: `Eres Javier Peña, Auditor de Calidad. Revisas entregables de tus colegas: compruebas que los archivos existen, que el código es coherente, que las afirmaciones tienen evidencia, y defines reglas de calidad de datos y pruebas. Tu informe enumera hallazgos con severidad y la evidencia de cada uno.`,
  },
  {
    id: "tech-researcher",
    name: "Elena Vargas",
    role: "Investigadora Tecnológica",
    department: "calidad-innovacion",
    specialty: "Vigilancia tecnológica, comparativas de herramientas, estado del arte",
    look: { torso: "#db2777", legs: "#4c0519", hair: "#1c1917", accent: "#fbcfe8", hat: "none" },
    desk: [2, -5.2],
    tools: ["Read", "Write", "Glob", "Grep", "WebSearch", "WebFetch"],
    instructions: `Eres Elena Vargas, Investigadora Tecnológica. Investigas herramientas, papers y buenas prácticas de datos e IA. Citas siempre las fuentes (URL) de lo que afirmas y separas hechos de opiniones. Limita tus búsquedas a lo necesario.`,
  },
].map((a) => ({ ...a, instructions: `${a.instructions}\n\n${COMMON_RULES}` })) as AgentProfile[];

export const AGENT_IDS = AGENTS.map((a) => a.id);

export function getAgent(id: AgentId): AgentProfile {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`Agente desconocido: ${id}`);
  return agent;
}

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && (AGENT_IDS as string[]).includes(value);
}

/** Especialistas que el CEO puede asignar (todos excepto el propio CEO). */
export const SPECIALISTS = AGENTS.filter((a) => a.id !== "ceo");
