import { promises as fs } from "node:fs";
import path from "node:path";
import { COLLECTIONS, emptyState, type ChangeSet, type PersistedState, type Repository } from "./repository";

/** Persistencia local en un archivo JSON (escritura atómica). Sin costos ni servicios externos. */
export class FileRepository implements Repository {
  readonly kind = "archivo" as const;
  private readonly file: string;

  constructor(dir: string) {
    this.file = path.join(dir, "state.json");
  }

  async load(): Promise<PersistedState> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, "utf8")) as Partial<PersistedState>;
      const state = emptyState();
      for (const c of COLLECTIONS) {
        if (Array.isArray(raw[c])) (state[c] as unknown[]) = raw[c] as unknown[];
      }
      return state;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      throw err;
    }
  }

  async save(_changes: ChangeSet, full: PersistedState): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(full, null, 2), "utf8");
    await fs.rename(tmp, this.file);
  }
}
