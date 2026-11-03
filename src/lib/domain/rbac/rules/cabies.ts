// CABIES rules — the base role every signed-in person has (developer-spec §14.2, §14.3).
//
// A CABIES can:
//   • view their own appraisal, history, statement and change history — nobody else's
//   • enter their own SELF items while the cycle is open (window rule in ./shared)
//
// Returning null means "this role has no opinion" so another role's rule may allow it.

import { allow, type Action, type Decision, type Principal } from "../types";
import { entryWindowDenial } from "./shared";

export function cabiesRule(p: Principal, a: Action): Decision | null {
  switch (a.type) {
    case "VIEW_APPRAISAL":
    case "VIEW_HISTORY":
    case "VIEW_STATEMENT":
    case "VIEW_CHANGE_HISTORY":
      return a.appraiseeId === p.cabiesId ? allow() : null;

    case "ENTER_ITEM": {
      const { item } = a;
      if (item.raterKind !== "SELF" || item.appraiseeId !== p.cabiesId) return null;
      return entryWindowDenial(item) ?? allow();
    }

    default:
      return null;
  }
}
