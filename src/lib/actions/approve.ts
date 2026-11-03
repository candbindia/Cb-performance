// Approve a CABIES's score for a cycle — orchestration only (permission check, write, audit).
// There is no separate Approvals tab yet (not in the agreed sheet schema); the approval is
// recorded as an AuditLog entry. A dedicated status column can be added when the scoring/close
// module is built, without changing this action's shape.

import { assertCan } from "../domain/rbac/permissions";
import type { ApproveeCtx, CycleCtx, Principal } from "../domain/rbac/types";
import type { AuditEntry, SheetsRepo } from "../sheets/repo";

export interface ApproveResult {
  approvedBy: string;
  appraiseeId: string;
  cycleMonth: string;
}

export async function approveScore(
  principal: Principal,
  appraisee: ApproveeCtx,
  cycle: CycleCtx,
  cycleMonth: string,
  repo: SheetsRepo,
  now: string,
): Promise<ApproveResult> {
  assertCan(principal, { type: "APPROVE_SCORE", cycle, appraisee });

  const entry: AuditEntry = {
    actorId: principal.cabiesId,
    actorType: principal.userTypes.has("HR") && appraisee.rmCabiesId === "" ? "HR" : "APPROVER",
    action: "APPROVE_SCORE",
    entity: "Cabies",
    entityId: appraisee.appraiseeId,
    field: "approval",
    before: "PENDING",
    after: "APPROVED",
    at: now,
  };
  await repo.appendAudit([entry]);

  return { approvedBy: principal.cabiesId, appraiseeId: appraisee.appraiseeId, cycleMonth };
}
