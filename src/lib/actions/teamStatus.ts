// A Team Lead/Manager's view of their direct reports' entry status.
// Orchestration only — permission check, then the pure aggregation in domain/approval/status.

import { assertCan } from "../domain/rbac/permissions";
import type { Principal } from "../domain/rbac/types";
import { buildTeamStatus, type ReportItemStatus, type TeamStatusInput } from "../domain/approval/status";

/**
 * `reports` is supplied by the caller (read from Users + ItemEvents for the open cycle).
 * This action only checks the permission and runs the pure aggregation — it does not
 * itself read the sheet, so it can be tested without a repo.
 */
export function getTeamStatus(principal: Principal, reports: readonly TeamStatusInput[]): ReportItemStatus[] {
  assertCan(principal, { type: "VIEW_TEAM_STATUS", rmCabiesId: principal.cabiesId });
  return buildTeamStatus(reports);
}
