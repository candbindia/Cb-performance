// Approval chain — decided 3 Nov 2026 (claude/kpi-only-plan.md §2):
//   Analyst  -> approved by their own Reporting Manager (a Team Lead)
//   Team Lead -> approved by their own Reporting Manager (a Manager)
//   Manager  -> approved by Management (the MDs)
// Only the appraisee's OWN RM may approve them — not just any eligible person in the
// department. If the appraisee has no RM on record, HR approves instead.
// VIEW_TEAM_STATUS: a person may see the status of their own direct reports.

import { allow, type Action, type Decision, type Principal } from "../types";

export function approverRule(p: Principal, a: Action): Decision | null {
  switch (a.type) {
    case "APPROVE_SCORE": {
      const { appraisee } = a;

      // Manager's score: Management approves, regardless of who is recorded as RM.
      if (appraisee.designation === "Manager") {
        return p.userTypes.has("MANAGEMENT") ? allow() : null;
      }

      // Analyst / Team Lead: only their own RM.
      if (appraisee.rmCabiesId) {
        return appraisee.rmCabiesId === p.cabiesId ? allow() : null;
      }

      // No RM on record: HR approves instead.
      return p.userTypes.has("HR") ? allow() : null;
    }

    case "VIEW_TEAM_STATUS":
      return a.rmCabiesId === p.cabiesId ? allow() : null;

    default:
      return null;
  }
}
