import { describe, expect, it } from "vitest";
import { applyEvent } from "@/lib/client/useOffice";
import type { OfficeSnapshot } from "@/lib/types";

const snap: OfficeSnapshot = {
  system: { agentsEnabled: false, persistence: "archivo", model: "m", effort: "low", maxBudgetUsd: 1, maxTurns: 1, authRequired: false },
  agents: [{ id: "ceo", status: "disponible", updatedAt: "", tasksCompleted: 0 }],
  projects: [],
  tasks: [],
  activity: [],
  findings: [],
  approvals: [],
};

describe("reductor de eventos del cliente", () => {
  it("aplica instantánea y actualizaciones incrementales", () => {
    let s = applyEvent(null, { type: "snapshot", data: snap });
    s = applyEvent(s, { type: "agent", data: { id: "ceo", status: "reunido", updatedAt: "", tasksCompleted: 0 } });
    expect(s?.agents[0].status).toBe("reunido");
    s = applyEvent(s, { type: "activity", data: { id: "e1", at: "", kind: "sistema", message: "hola" } });
    expect(s?.activity).toHaveLength(1);
  });

  it("ignora eventos antes de la primera instantánea", () => {
    expect(applyEvent(null, { type: "activity", data: { id: "e1", at: "", kind: "sistema", message: "x" } })).toBeNull();
  });
});
