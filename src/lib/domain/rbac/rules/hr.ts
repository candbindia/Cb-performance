// HR rules — developer-spec §14.2 and the KPI-only plan.
//
// HR can:
//   • manage KPI parameters (read + write the parameter sets)
//   • view any CABIES' appraisal / history / statement / change history
//   • view the org overview
// Approvals, HR-check and close come in a later step.

import { allow, type Action, type Decision, type Principal } from "../types";

export function hrRule(p: Principal, a: Action): Decision | null {
  if (!p.userTypes.has("HR")) return null;

  switch (a.type) {
    case "MANAGE_KPI_PARAMS":
    case "VIEW_ORG_OVERVIEW":
    case "VIEW_APPRAISAL":
    case "VIEW_HISTORY":
    case "VIEW_STATEMENT":
    case "VIEW_CHANGE_HISTORY":
      return allow(); // HR sees everyone
    default:
      return null;
  }
}
