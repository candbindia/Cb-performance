// Deriving an item's current value and status from its event history (developer-spec §10.4).
// Pure. The caller reads the events (readItemEvents), this just interprets them.

import type { ItemEvent } from "../../sheets/repo";

export type ItemStatus = "NOT_ENTERED" | "ENTERED" | "VALIDATED" | "AUTO_VALIDATED" | "SENT_BACK";

export interface ItemState {
  value: number | null;
  status: ItemStatus;
  enteredBy: string | null;
  enteredAt: string | null;
}

/** Events for ONE question, in any order. Returns the derived current state. */
export function deriveItemState(events: readonly ItemEvent[]): ItemState {
  if (events.length === 0) return { value: null, status: "NOT_ENTERED", enteredBy: null, enteredAt: null };

  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted[sorted.length - 1]!;

  const valueEvent = [...sorted].reverse().find((e) => e.type === "ENTER" || e.type === "RM_FILL" || e.type === "CORRECT");

  const status: ItemStatus =
    last.type === "SEND_BACK" ? "SENT_BACK" :
    last.type === "VALIDATE" || last.type === "CORRECT" ? "VALIDATED" :
    last.type === "AUTO_VALIDATE" ? "AUTO_VALIDATED" :
    valueEvent ? "ENTERED" : "NOT_ENTERED";

  return {
    value: valueEvent?.points ?? null,
    status,
    enteredBy: valueEvent?.actorId ?? null,
    enteredAt: valueEvent?.at ?? null,
  };
}

/** Group a person's events by question, then derive state per question. */
export function deriveAllItemStates(events: readonly ItemEvent[]): Map<string, ItemState> {
  const byQuestion = new Map<string, ItemEvent[]>();
  for (const e of events) {
    const arr = byQuestion.get(e.question) ?? [];
    arr.push(e);
    byQuestion.set(e.question, arr);
  }
  const out = new Map<string, ItemState>();
  for (const [q, evs] of byQuestion) out.set(q, deriveItemState(evs));
  return out;
}
