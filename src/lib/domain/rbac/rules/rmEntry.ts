// RM-rated item entry — NOT the general "Reporting Manager" role (that is still waiting on
// Dinesh's details and nothing there is assumed). This is narrower: it is the mechanic the
// KPI parameters already encode (developer-spec colour mapping, confirmed 3 Nov) — an item
// with no colour in the appraisal sheet is rated by "the person the CABIES reports to"
// (Analyst's Team Lead, Team Lead's Manager, Manager's Management). Without this rule, those
// items could never be entered by anyone. It grants ONLY that one action, to whoever is
// literally named as the appraisee's RM for that item — nothing wider (no team view, no
// missing-item fill, no escalation).

import { allow, type Action, type Decision, type Principal } from "../types";
import { entryWindowDenial } from "./shared";

export function rmEntryRule(p: Principal, a: Action): Decision | null {
  if (a.type !== "ENTER_ITEM") return null;
  const { item } = a;
  if (item.raterKind !== "RM") return null;
  if (!item.appraiseeRmCabiesId || item.appraiseeRmCabiesId !== p.cabiesId) return null;
  return entryWindowDenial(item) ?? allow();
}
