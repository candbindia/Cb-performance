// Appraisal cycle rules. Pure: the caller supplies the cycle row and today's date.
// Dates are YYYY-MM-DD strings, which sort correctly as plain text.

export type CycleStatus = "UPCOMING" | "OPEN" | "CLOSED";

export interface CycleRow {
  month: string;            // YYYY-MM
  status: CycleStatus;
  entryDeadline: string;    // YYYY-MM-DD, last day entry is accepted
  approvalDeadline: string; // YYYY-MM-DD
  closedAt: string;         // blank until HR closes the cycle
}

// Today's date in India time, so a deadline isn't missed by a day because of UTC.
export function todayIst(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

/** The cycle people can enter scores into right now, if any. */
export function openCycle(rows: readonly CycleRow[]): CycleRow | null {
  return rows.find((r) => r.status === "OPEN") ?? null;
}

/** Entry is allowed only while the cycle is OPEN and today is on or before the deadline. */
export function entryDecision(cycle: CycleRow | null, today: string): { allowed: boolean; reason?: string } {
  if (!cycle) return { allowed: false, reason: "No appraisal cycle is open." };
  if (cycle.status !== "OPEN") return { allowed: false, reason: `Cycle ${cycle.month} is ${cycle.status.toLowerCase()}.` };
  if (today > cycle.entryDeadline) return { allowed: false, reason: `The entry deadline for ${cycle.month} was ${cycle.entryDeadline}.` };
  return { allowed: true };
}

/** True once today is past the entry deadline. Feeds the deadlinePassed flag in the entry rule. */
export function deadlinePassed(cycle: CycleRow | null, today: string): boolean {
  return cycle !== null && today > cycle.entryDeadline;
}