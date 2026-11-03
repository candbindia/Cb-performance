// Project Coordinator (PC) rules — developer-spec §10.1, §11.1, §11.2, §14.2.
//
// A PC is the coordinator of one or more departments (UnitPCs). Within THEIR OWN departments only, a PC can:
//   • enter items whose rater kind is PC, for CABIES in that department
//   • create projects
//   • assign CABIES to projects (until the tracker cut-off)
//   • enable / disable project pay on an assignment (until the tracker cut-off)
//
// A PC gets no extra read access to other CABIES' appraisals (spec matrix shows none).
// Cycle-open and own-appraisal checks are applied for everyone in permissions.ts (commonChecks).

import { allow, type Action, type Decision, type Principal } from "../types";
import { entryWindowDenial } from "./shared";

export function pcRule(p: Principal, a: Action): Decision | null {
  if (!p.userTypes.has("PC")) return null;

  switch (a.type) {
    case "ENTER_ITEM": {
      const { item } = a;
      if (item.raterKind !== "PC") return null;
      if (!p.pcUnitIds.has(item.appraiseeDepartmentId)) return null;
      return entryWindowDenial(item) ?? allow();
    }

    case "CREATE_PROJECT":
      return p.pcUnitIds.has(a.departmentId) ? allow() : null;

    case "ASSIGN_TO_PROJECT":
    case "SET_PROJECT_PAY_ENABLED":
      return p.pcUnitIds.has(a.departmentId) ? allow() : null;

    default:
      return null;
  }
}
