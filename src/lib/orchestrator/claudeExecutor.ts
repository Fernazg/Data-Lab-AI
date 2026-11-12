import "server-only";
import { createSdkMcpServer, query, tool, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { config } from "../config";
import { TEAM_SERVER, TEAM_TOOL_PREFIX } from "./policy";
import { AgentRunError, type AgentExecutor } from "./executor";

/** Variables de entorno que el proceso del agente necesita. El resto (Supabase, ADMIN_TOKEN…) no se le pasa. */
const ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "TMPDIR",
  "TERM",
  "SHELL",
  "USER",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
];

function agentEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const k of ENV_ALLOWLIST) {
    const v = process.env[k];
    if (v) env[k] = v;
  }
  return env;
}

/** Ejecuta un agente real con el Claude Agent SDK. */
export const claudeExecutor: AgentExecutor = async (req, hooks) => {
  const teamServer = createSdkMcpServer({
    name: TEAM_SERVER,
    version: "1.0.0",
    tools: [
      tool(
        "compartir_hallazgo",
        "Comparte con el resto del equipo del proyecto una decisión, dato o resultado que otros necesiten.",
        { tema: z.string().min(1).max(120), contenido: z.string().min(1).max(4000) },
        async ({ tema, contenido }) => ({ content: [{ type: "text", text: hooks.team.share(tema, contenido) }] }),
      ),
      tool(
        "leer_hallazgos",
        "Lee todos los hallazgos compartidos por el equipo en este proyecto.",
        {},
        async () => ({ content: [{ type: "text", text: hooks.team.read() }] }),
      ),
    ],
  });

  const abortController = new AbortController();
  const onAbort = () => abortController.abort();
  req.signal.addEventListener("abort", onAbort, { once: true });

  let turns = 0;
  let costUsd = 0;
  let lastText = "";

  try {
    const stream = query({
      prompt: req.prompt,
      options: {
        model: config.model,
        effort: config.effort,
        systemPrompt: req.systemPrompt,
        cwd: req.cwd,
        tools: req.tools,
        allowedTools: [`${TEAM_TOOL_PREFIX}compartir_hallazgo`, `${TEAM_TOOL_PREFIX}leer_hallazgos`],
        mcpServers: { [TEAM_SERVER]: teamServer },
        // Sin configuración de usuario/proyecto: el comportamiento depende solo de este código.
        settingSources: [],
        permissionMode: "default",
        persistSession: false,
        maxTurns: req.maxTurns,
        maxBudgetUsd: config.maxBudgetUsd,
        outputFormat: { type: "json_schema", schema: req.outputSchema },
        abortController,
        env: agentEnv(),
        canUseTool: async (toolName, input) => {
          const answer = await hooks.canUseTool(toolName, input);
          return answer.allow
            ? { behavior: "allow", updatedInput: input }
            : { behavior: "deny", message: answer.reason };
        },
      },
    });

    for await (const message of stream as AsyncIterable<SDKMessage>) {
      if (message.type === "assistant" && message.parent_tool_use_id === null) {
        turns++;
        hooks.onTurn(turns);
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            hooks.onToolUse(block.name, (block.input ?? {}) as Record<string, unknown>);
          } else if (block.type === "text" && block.text.trim()) {
            lastText = block.text;
            hooks.onText(block.text);
          }
        }
        if (message.error) throw new AgentRunError(`Error del modelo: ${message.error}`, costUsd, turns);
      } else if (message.type === "result") {
        costUsd = message.total_cost_usd ?? 0;
        if (message.subtype !== "success") {
          const reasons: Record<string, string> = {
            error_max_turns: "Se alcanzó el máximo de turnos permitido",
            error_max_budget_usd: "Se alcanzó el presupuesto máximo por ejecución",
            error_during_execution: "Error durante la ejecución",
            error_max_structured_output_retries: "El agente no produjo un informe con el formato requerido",
          };
          throw new AgentRunError(reasons[message.subtype] ?? message.subtype, costUsd, message.num_turns);
        }
        if (message.structured_output === undefined) {
          throw new AgentRunError("El agente terminó sin informe estructurado", costUsd, message.num_turns);
        }
        return { structured: message.structured_output, text: message.result || lastText, costUsd, turns: message.num_turns };
      }
    }
    throw new AgentRunError("La ejecución terminó sin resultado", costUsd, turns);
  } catch (err) {
    if (err instanceof AgentRunError) throw err;
    if (req.signal.aborted) throw new AgentRunError("Ejecución cancelada", costUsd, turns);
    throw new AgentRunError(err instanceof Error ? err.message : String(err), costUsd, turns);
  } finally {
    req.signal.removeEventListener("abort", onAbort);
  }
};
