import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileRepository } from "@/lib/persistence/fileRepository";
import { emptyState } from "@/lib/persistence/repository";

describe("repositorio en archivo", () => {
  it("devuelve estado vacío si no existe y guarda/carga ida y vuelta", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "datalab-repo-"));
    try {
      const repo = new FileRepository(dir);
      expect(await repo.load()).toEqual(emptyState());
      const state = emptyState();
      state.findings.push({ id: "f1", projectId: "p", agentId: "ceo", topic: "t", content: "c", at: "now" });
      await repo.save({}, state);
      expect((await new FileRepository(dir).load()).findings[0].id).toBe("f1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
