// Management (MD) rules — developer-spec §14.2 and the KPI-only plan.
//
// Management can:
//   • view the org overview (read-only)
//   • view any CABIES' appraisal / history / statement / change history
// Management does NOT manage KPI parameters (that is HR).
// Approving Managers' scores comes in the approvals step.
// MDs are themselves exempt from appraisal — enforced where scorecards are built, not here.

import { allow, type Action, type Decision, type Principal } from "../types";

export function managementRule(p: Principal, a: Action): Decision | null {
  if (!p.userTypes.has("MANAGEMENT")) return null;

  switch (a.type) {
    case "VIEW_ORG_OVERVIEW":
    case "VIEW_APPRAISAL":
    case "VIEW_HISTORY":
    case "VIEW_STATEMENT":
    case "VIEW_CHANGE_HISTORY":
      return allow();
    default:
      return null;
  }
}
