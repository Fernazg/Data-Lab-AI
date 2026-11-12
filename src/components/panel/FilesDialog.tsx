"use client";

import { useEffect, useState } from "react";

interface FileEntry {
  path: string;
  bytes: number;
}

/** Explorador de solo lectura de los archivos reales que generaron los agentes. */
export function FilesDialog({ projectId, title, onClose }: { projectId: string; title: string; onClose: () => void }) {
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/files`)
      .then((r) => r.json())
      .then((d: { files?: FileEntry[]; error?: string }) => (d.files ? setFiles(d.files) : setError(d.error ?? "Error")))
      .catch(() => setError("No se pudo cargar la lista de archivos"));
  }, [projectId]);

  useEffect(() => {
    if (!selected) return;
    setContent("Cargando…");
    fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((d: { content?: string; error?: string }) => setContent(d.content ?? d.error ?? ""))
      .catch(() => setContent("No se pudo leer el archivo"));
  }, [projectId, selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Entregables · {title}</h2>
            <p className="text-[11px] text-zinc-500">workspace/{projectId}</p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100" aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <ul className="max-h-48 overflow-auto border-b border-zinc-200 p-2 sm:max-h-none sm:w-64 sm:border-b-0 sm:border-r">
            {error && <li className="text-xs text-red-700">{error}</li>}
            {files === null && !error && <li className="text-xs text-zinc-500">Cargando…</li>}
            {files?.length === 0 && <li className="text-xs text-zinc-500">Sin archivos todavía.</li>}
            {files?.map((f) => (
              <li key={f.path}>
                <button
                  onClick={() => setSelected(f.path)}
                  className={`w-full truncate rounded px-2 py-1 text-left font-mono text-xs ${selected === f.path ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
                  title={f.path}
                >
                  {f.path} <span className="opacity-60">({f.bytes} B)</span>
                </button>
              </li>
            ))}
          </ul>
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-zinc-50 p-4 font-mono text-xs text-zinc-800">
            {selected ? content : "Selecciona un archivo para ver su contenido."}
          </pre>
        </div>
      </div>
    </div>
  );
}
