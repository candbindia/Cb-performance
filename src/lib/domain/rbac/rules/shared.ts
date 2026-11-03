// Rule fragments shared by several user types.

import { deny, type Decision, type ItemCtx } from "../types";

/**
 * When may the rater of an item change its value? (spec §10.2, §10.3)
 *  - until their deadline;
 *  - after it only if the item was sent back;
 *  - never once validated / auto-validated.
 * Returns null when the window is open (caller then allows).
 */
export function entryWindowDenial(item: ItemCtx): Decision | null {
  if (item.status === "VALIDATED" || item.status === "AUTO_VALIDATED") return deny("ENTRY_WINDOW_CLOSED");
  if (item.deadlinePassed && item.status !== "SENT_BACK") return deny("ENTRY_WINDOW_CLOSED");
  return null;
}
