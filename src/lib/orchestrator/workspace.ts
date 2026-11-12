import { promises as fs } from "node:fs";
import path from "node:path";
import { isInside } from "./policy";

/** Espacio de trabajo aislado por proyecto: los agentes solo leen y escriben aquí. */
export async function ensureWorkspace(root: string, projectId: string, request: string): Promise<string> {
  if (!/^[a-z0-9_-]+$/i.test(projectId)) throw new Error("Identificador de proyecto inválido");
  const dir = path.join(root, projectId);
  await fs.mkdir(dir, { recursive: true });
  const brief = path.join(dir, "SOLICITUD.md");
  await fs.writeFile(brief, `# Solicitud del cliente\n\n${request}\n`, { flag: "wx" }).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== "EEXIST") throw err;
  });
  return dir;
}

/** Comprueba en disco qué entregables declarados existen realmente. */
export async function verifyDeliverables(dir: string, deliverables: string[]) {
  return Promise.all(
    deliverables.map(async (p) => {
      const rel = path.isAbsolute(p) ? path.relative(dir, p) : p;
      if (!isInside(dir, rel)) return { path: p, exists: false, bytes: 0 };
      try {
        const stat = await fs.stat(path.join(dir, rel));
        return { path: rel, exists: stat.isFile() || stat.isDirectory(), bytes: stat.isFile() ? stat.size : 0 };
      } catch {
        return { path: rel, exists: false, bytes: 0 };
      }
    }),
  );
}

/** Lista los archivos del espacio de trabajo (para el panel y la revisión del CEO). */
export async function listWorkspace(dir: string, limit = 200): Promise<{ path: string; bytes: number }[]> {
  const out: { path: string; bytes: number }[] = [];
  async function walk(current: string) {
    if (out.length >= limit) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(current, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) out.push({ path: path.relative(dir, full), bytes: (await fs.stat(full)).size });
    }
  }
  await walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** Lee un archivo del espacio de trabajo con límite de tamaño (vista previa en el panel). */
export async function readWorkspaceFile(dir: string, rel: string, maxBytes = 200_000): Promise<string> {
  if (!isInside(dir, rel)) throw new Error("Ruta fuera del espacio de trabajo");
  const full = path.join(dir, rel);
  const handle = await fs.open(full, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    const text = buffer.subarray(0, bytesRead).toString("utf8");
    const { size } = await handle.stat();
    return size > maxBytes ? `${text}\n\n… (archivo truncado: ${size} bytes)` : text;
  } finally {
    await handle.close();
  }
}
