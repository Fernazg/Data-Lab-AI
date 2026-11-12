import { describe, expect, it } from "vitest";
import { jsonSchemaOf, planSchema, validatePlan } from "@/lib/orchestrator/schemas";

const task = (clave: string, depende_de: string[] = [], responsable = "data-engineer") => ({
  clave,
  titulo: `Tarea ${clave}`,
  descripcion: "Descripción suficientemente larga",
  responsable,
  depende_de,
});

describe("validación del plan del CEO", () => {
  it("acepta un plan válido", () => {
    const r = validatePlan({ titulo_proyecto: "Proyecto", razonamiento: "ok", tareas: [task("a"), task("b", ["a"], "quality-auditor")] });
    expect(r.ok).toBe(true);
  });

  it("rechaza responsables desconocidos o el propio CEO", () => {
    expect(validatePlan({ titulo_proyecto: "P", razonamiento: "ok", tareas: [task("a", [], "ceo")] }).ok).toBe(false);
    expect(validatePlan({ titulo_proyecto: "Proy", razonamiento: "ok", tareas: [task("a", [], "becario")] }).ok).toBe(false);
  });

  it("rechaza dependencias inexistentes, duplicados y ciclos", () => {
    const base = { titulo_proyecto: "Proyecto", razonamiento: "ok" };
    expect(validatePlan({ ...base, tareas: [task("a", ["z"])] })).toMatchObject({ ok: false });
    expect(validatePlan({ ...base, tareas: [task("a"), task("a")] })).toMatchObject({ ok: false });
    const cyc = validatePlan({ ...base, tareas: [task("a", ["b"]), task("b", ["a"])] });
    expect(cyc).toMatchObject({ ok: false, error: expect.stringContaining("circulares") });
  });

  it("genera un JSON Schema para el SDK", () => {
    const schema = jsonSchemaOf(planSchema);
    expect(schema.type).toBe("object");
    expect(schema).not.toHaveProperty("$schema");
  });
});
