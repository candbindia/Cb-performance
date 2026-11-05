// Group-rated item entry: HR, Admin, Operations and other rater groups enter the items
// tagged with their group in KPI_Parameters (raterGroupId). Company-wide — not scoped to
// department or reporting line, since the Groups tab, not the org chart, decides who can
// rate a GROUP item (confirmed 5 Nov).
//
// Self-rating is allowed here: a person grades their own GROUP item if they are themselves
// in that item's rater group — e.g. HR grades their own HR-tagged items (decided 5 Nov,
// carve-out in the own-appraisal guard in permissions.ts). Every other combination is still
// blocked by that guard before this rule ever runs.

import { allow, type Action, type Decision, type Principal } from "../types";
import { entryWindowDenial } from "./shared";

export function groupRule(p: Principal, a: Action): Decision | null {
  if (a.type !== "ENTER_ITEM") return null;
  const { item } = a;
  if (item.raterKind !== "GROUP") return null;
  if (!item.raterGroupId || !p.groupIds.has(item.raterGroupId)) return null;
  return entryWindowDenial(item) ?? allow();
}