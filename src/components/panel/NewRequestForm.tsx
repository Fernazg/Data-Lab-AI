"use client";

import { useState } from "react";
import { postAction } from "@/lib/client/useOffice";
import type { SystemInfo } from "@/lib/types";

const EXAMPLES = [
  "Diseña un modelo dimensional para las ventas de una tienda online (pedidos, clientes, productos) con el DDL en SQL y un diccionario de datos.",
  "Crea un pipeline en Python que genere un dataset sintético de clientes, lo limpie y calcule métricas de churn, con pruebas de calidad de datos.",
  "Compara dbt, SQLMesh y Dataform para un equipo pequeño y recomienda una opción con fuentes.",
];

/** El usuario envía una solicitud al CEO. */
export function NewRequestForm({ system }: { system: SystemInfo }) {
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !system.agentsEnabled;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postAction("/api/projects", { request });
      setRequest("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <label htmlFor="request" className="text-xs font-bold uppercase tracking-wide text-zinc-600">
        Nueva solicitud para la CEO
      </label>
      <textarea
        id="request"
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={4}
        maxLength={8000}
        disabled={disabled || busy}
        placeholder="Describe el proyecto de datos que necesitas…"
        className="w-full resize-y rounded-lg border border-zinc-300 p-2 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-100"
      />
      {!request && !disabled && (
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setRequest(ex)} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-200" title={ex}>
              {ex.slice(0, 38)}…
            </button>
          ))}
        </div>
      )}
      {disabled && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">{system.agentsDisabledReason}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          La CEO propondrá un plan; nada se ejecuta sin tu aprobación. Límite: ${system.maxBudgetUsd.toFixed(2)} y {system.maxTurns} turnos por agente.
        </p>
        <button
          type="submit"
          disabled={disabled || busy || request.trim().length < 10}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
