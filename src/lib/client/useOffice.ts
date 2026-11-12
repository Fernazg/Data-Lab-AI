"use client";

import { useEffect, useReducer, useState } from "react";
import type { OfficeSnapshot, ServerEvent } from "../types";

const MAX_ACTIVITY = 300;

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export function applyEvent(state: OfficeSnapshot | null, event: ServerEvent): OfficeSnapshot | null {
  if (event.type === "snapshot") return event.data;
  if (!state) return state;
  switch (event.type) {
    case "agent":
      return { ...state, agents: upsert(state.agents, event.data) };
    case "project":
      return { ...state, projects: upsert(state.projects, event.data) };
    case "task":
      return { ...state, tasks: upsert(state.tasks, event.data) };
    case "finding":
      return { ...state, findings: upsert(state.findings, event.data) };
    case "approval":
      return { ...state, approvals: upsert(state.approvals, event.data) };
    case "activity":
      return { ...state, activity: [...state.activity, event.data].slice(-MAX_ACTIVITY) };
  }
}

export type Connection = "conectando" | "conectado" | "desconectado";

/** Estado de la oficina sincronizado en tiempo real con el servidor. */
export function useOffice() {
  const [state, dispatch] = useReducer(applyEvent, null);
  const [connection, setConnection] = useState<Connection>("conectando");

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => setConnection("conectado");
    source.onerror = () => setConnection(source.readyState === EventSource.CLOSED ? "desconectado" : "conectando");
    source.onmessage = (msg) => {
      try {
        dispatch(JSON.parse(msg.data) as ServerEvent);
      } catch {
        // mensaje malformado: se ignora
      }
    };
    return () => source.close();
  }, []);

  return { state, connection };
}

// ── Acciones ────────────────────────────────────────────────────

const TOKEN_KEY = "datalab.adminToken";

function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** POST con token de administración opcional. Pide el token si el servidor lo exige. */
export async function postAction<T = unknown>(url: string, body?: unknown): Promise<T> {
  const send = (token: string | null) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let res = await send(getToken());
  if (res.status === 401) {
    const token = window.prompt("Este servidor requiere el token de administración (ADMIN_TOKEN):");
    if (!token) throw new Error("Se requiere el token de administración.");
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // almacenamiento no disponible: se usa solo para esta petición
    }
    res = await send(token);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data as T;
}
