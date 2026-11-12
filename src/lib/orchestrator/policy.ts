import path from "node:path";
import type { AgentProfile } from "../agents/roster";

/**
 * Política de permisos de herramientas. Función pura: dado un agente y una llamada,
 * decide si se permite, se deniega o requiere autorización humana.
 */
export type ToolDecision =
  | { decision: "allow" }
  | { decision: "deny"; reason: string }
  | { decision: "ask"; title: string; detail: string };

/** Prefijo de las herramientas internas del equipo (servidor MCP en proceso). */
export const TEAM_SERVER = "equipo";
export const TEAM_TOOL_PREFIX = `mcp__${TEAM_SERVER}__`;

const SENSITIVE_FILE = /(^|[\\/])(\.env(\..*)?|\.npmrc|\.netrc|id_rsa[^\\/]*|id_ed25519[^\\/]*|[^\\/]*\.pem|[^\\/]*\.key|credentials[^\\/]*)$/i;

/** Comandos que nunca se permiten, ni siquiera con aprobación. */
const FORBIDDEN_COMMANDS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bsudo\b|\bsu\s/, reason: "No se permiten privilegios de administrador." },
  { pattern: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*\s+(\/|~|\$HOME)(\s|$)/i, reason: "Borrado masivo del sistema bloqueado." },
  { pattern: /\b(printenv|env)\b(\s*$|\s*\||\s*>)|\bset\s*$|\$\{?[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/i, reason: "Leer variables de entorno o secretos está prohibido." },
  { pattern: /(^|[\s;&|])(cat|less|more|head|tail|cp|scp)\s+[^;&|]*(\.env|\.ssh|id_rsa|\.aws|\.npmrc|\.netrc)/i, reason: "Acceso a archivos de credenciales bloqueado." },
  { pattern: /\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/i, reason: "Ejecutar scripts remotos está prohibido." },
  { pattern: /\bgit\s+push\b|\bnpm\s+publish\b|\bdocker\s+push\b/i, reason: "Publicar en servicios externos está prohibido." },
  { pattern: /\b(ssh|scp|sftp|nc|ncat|telnet)\b/i, reason: "Conexiones remotas no permitidas." },
  { pattern: /\b(stripe|paypal)\b/i, reason: "No se permiten compras ni contrataciones." },
];

/** Herramientas de solo lectura que operan sobre rutas. */
const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const WRITE_TOOLS = new Set(["Write", "Edit"]);
const WEB_TOOLS = new Set(["WebSearch", "WebFetch"]);

export function isInside(root: string, target: string): boolean {
  const resolved = path.resolve(root, target);
  const rel = path.relative(path.resolve(root), resolved);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function pathArg(input: Record<string, unknown>): string | undefined {
  for (const key of ["file_path", "path", "notebook_path"]) {
    const v = input[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/** Herramienta interna del SDK con la que el agente entrega su informe final (outputFormat). */
export const STRUCTURED_OUTPUT_TOOL = "StructuredOutput";

export function decideTool(
  agent: AgentProfile,
  toolName: string,
  input: Record<string, unknown>,
  workspaceDir: string,
): ToolDecision {
  if (toolName.startsWith(TEAM_TOOL_PREFIX) || toolName === STRUCTURED_OUTPUT_TOOL) return { decision: "allow" };

  if (!(agent.tools as string[]).includes(toolName)) {
    return { decision: "deny", reason: `${agent.name} no tiene permitida la herramienta ${toolName}.` };
  }

  if (READ_TOOLS.has(toolName) || WRITE_TOOLS.has(toolName)) {
    const p = pathArg(input);
    if (p && !isInside(workspaceDir, p)) {
      return { decision: "deny", reason: `Ruta fuera del espacio de trabajo del proyecto: ${p}` };
    }
    if (p && SENSITIVE_FILE.test(p)) {
      return { decision: "deny", reason: "Los archivos de credenciales están protegidos." };
    }
    return { decision: "allow" };
  }

  if (WEB_TOOLS.has(toolName)) return { decision: "allow" };

  if (toolName === "Bash") {
    const command = typeof input.command === "string" ? input.command : "";
    for (const rule of FORBIDDEN_COMMANDS) {
      if (rule.pattern.test(command)) return { decision: "deny", reason: rule.reason };
    }
    const description = typeof input.description === "string" ? input.description : "";
    return {
      decision: "ask",
      title: description ? `Ejecutar comando: ${description}` : "Ejecutar comando de shell",
      detail: command,
    };
  }

  return { decision: "deny", reason: `Herramienta no contemplada por la política: ${toolName}` };
}

/** Clasifica una herramienta para el estado visible del agente. */
export function statusForTool(toolName: string): "investigando" | "trabajando" {
  if (WEB_TOOLS.has(toolName) || READ_TOOLS.has(toolName) || toolName === `${TEAM_TOOL_PREFIX}leer_hallazgos`) {
    return "investigando";
  }
  return "trabajando";
}

/** Descripción breve y segura de una llamada a herramienta para el registro de actividad. */
export function describeToolCall(toolName: string, input: Record<string, unknown>): { message: string; detail?: string } {
  const short = (s: unknown, n = 160) => (typeof s === "string" ? (s.length > n ? `${s.slice(0, n)}…` : s) : undefined);
  switch (toolName) {
    case "Read":
      return { message: "Leyendo archivo", detail: short(input.file_path) };
    case "Write":
      return { message: "Escribiendo archivo", detail: short(input.file_path) };
    case "Edit":
      return { message: "Editando archivo", detail: short(input.file_path) };
    case "Glob":
      return { message: "Buscando archivos", detail: short(input.pattern) };
    case "Grep":
      return { message: "Buscando en el código", detail: short(input.pattern) };
    case "Bash":
      return { message: "Comando de shell", detail: short(input.command, 300) };
    case "WebSearch":
      return { message: "Búsqueda web", detail: short(input.query) };
    case "WebFetch":
      return { message: "Consultando página web", detail: short(input.url) };
    case `${TEAM_TOOL_PREFIX}compartir_hallazgo`:
      return { message: "Compartiendo hallazgo con el equipo", detail: short(input.tema) };
    case `${TEAM_TOOL_PREFIX}leer_hallazgos`:
      return { message: "Consultando hallazgos del equipo" };
    case STRUCTURED_OUTPUT_TOOL:
      return { message: "Entregando informe final" };
    default:
      return { message: `Herramienta ${toolName}` };
  }
}
