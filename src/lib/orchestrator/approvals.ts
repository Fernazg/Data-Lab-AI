import type { Approval } from "../types";
import type { OfficeStore } from "./store";

export interface ApprovalOutcome {
  approved: boolean;
  note?: string;
}

/**
 * Puerta de autorización humana: registra una aprobación pendiente y espera
 * hasta que una persona la resuelva desde el panel (o se cancele la ejecución).
 */
export class ApprovalGate {
  private waiters = new Map<string, (outcome: ApprovalOutcome) => void>();

  constructor(private readonly store: OfficeStore) {}

  request(input: Omit<Approval, "id" | "createdAt" | "status">, signal?: AbortSignal): { approval: Approval; outcome: Promise<ApprovalOutcome> } {
    const approval = this.store.addApproval(input);
    this.store.log({
      kind: "aprobacion",
      agentId: input.agentId,
      projectId: input.projectId,
      taskId: input.taskId,
      message: `Solicita autorización: ${input.title}`,
      detail: input.detail.slice(0, 400),
    });
    const outcome = new Promise<ApprovalOutcome>((resolve) => {
      this.waiters.set(approval.id, resolve);
      signal?.addEventListener(
        "abort",
        () => {
          if (this.waiters.delete(approval.id)) {
            this.store.resolveApproval(approval.id, "expirada", "Ejecución cancelada");
            resolve({ approved: false, note: "Ejecución cancelada" });
          }
        },
        { once: true },
      );
    });
    return { approval, outcome };
  }

  /** Resuelve una aprobación pendiente. Devuelve false si ya no estaba pendiente. */
  resolve(id: string, approved: boolean, note?: string): boolean {
    const waiter = this.waiters.get(id);
    const approval = this.store.getApproval(id);
    if (!waiter || !approval || approval.status !== "pendiente") return false;
    this.waiters.delete(id);
    this.store.resolveApproval(id, approved ? "aprobada" : "rechazada", note);
    this.store.log({
      kind: "aprobacion",
      agentId: approval.agentId,
      projectId: approval.projectId,
      taskId: approval.taskId,
      message: `${approved ? "Autorizado" : "Rechazado"}: ${approval.title}`,
      detail: note,
    });
    waiter({ approved, note });
    return true;
  }

  /** Cancela todas las aprobaciones pendientes de un proyecto. */
  cancelProject(projectId: string, reason: string) {
    for (const [id, waiter] of this.waiters) {
      const ap = this.store.getApproval(id);
      if (ap?.projectId !== projectId) continue;
      this.waiters.delete(id);
      this.store.resolveApproval(id, "expirada", reason);
      waiter({ approved: false, note: reason });
    }
  }
}
