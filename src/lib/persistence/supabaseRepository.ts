import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { COLLECTIONS, emptyState, type ChangeSet, type Collection, type PersistedState, type Repository } from "./repository";

/** Nombre de tabla en Supabase para cada colección (ver supabase/migrations). */
const TABLES: Record<Collection, string> = {
  projects: "dl_projects",
  tasks: "dl_tasks",
  activity: "dl_activity",
  findings: "dl_findings",
  approvals: "dl_approvals",
  memory: "dl_memory",
};

const LOAD_LIMIT = 2000;

/**
 * Persistencia en Supabase. Usa la service role key SOLO en el servidor.
 * Cada fila guarda el objeto completo en `data` (jsonb) y columnas indexables.
 */
export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async load(): Promise<PersistedState> {
    const state = emptyState();
    for (const c of COLLECTIONS) {
      // Se cargan las filas más recientes y se devuelven en orden cronológico.
      const { data, error } = await this.db
        .from(TABLES[c])
        .select("data")
        .order("created_at", { ascending: false })
        .limit(LOAD_LIMIT);
      if (error) throw new Error(`Supabase (${TABLES[c]}): ${error.message}`);
      (state[c] as unknown[]) = (data ?? []).map((row) => row.data).reverse();
    }
    return state;
  }

  async save(changes: ChangeSet): Promise<void> {
    for (const c of COLLECTIONS) {
      const rows = changes[c] as { id: string; projectId?: string; createdAt?: string; at?: string }[] | undefined;
      if (!rows?.length) continue;
      const payload = rows.map((r) => ({
        id: r.id,
        project_id: r.projectId ?? null,
        created_at: r.createdAt ?? r.at ?? new Date().toISOString(),
        data: r,
      }));
      const { error } = await this.db.from(TABLES[c]).upsert(payload, { onConflict: "id" });
      if (error) throw new Error(`Supabase (${TABLES[c]}): ${error.message}`);
    }
  }
}
