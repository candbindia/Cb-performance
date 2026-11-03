// Team status — pure aggregation for a Team Lead/Manager's view of their direct reports.
// Shows entry status per person; never computes or exposes a score here (that's the
// scoring engine, a later step). No I/O.

export type EntryStatus = "NOT_ENTERED" | "MISSING" | "ENTERED" | "SENT_BACK" | "VALIDATED" | "AUTO_VALIDATED";

export interface ReportItemStatus {
  cabiesId: string;
  name: string;
  /** Count of that person's items in each status, for the current cycle. */
  counts: Record<EntryStatus, number>;
  /** True if every item for this person has SOME value entered (none NOT_ENTERED/MISSING). */
  allEntered: boolean;
  /** True if any item is MISSING (blocks approval per the plan). */
  hasMissing: boolean;
}

export interface TeamStatusInput {
  cabiesId: string;
  name: string;
  itemStatuses: EntryStatus[];
}

export function buildTeamStatus(reports: readonly TeamStatusInput[]): ReportItemStatus[] {
  return reports.map((r) => {
    const counts: Record<EntryStatus, number> = {
      NOT_ENTERED: 0, MISSING: 0, ENTERED: 0, SENT_BACK: 0, VALIDATED: 0, AUTO_VALIDATED: 0,
    };
    for (const s of r.itemStatuses) counts[s] += 1;
    return {
      cabiesId: r.cabiesId,
      name: r.name,
      counts,
      allEntered: counts.NOT_ENTERED === 0 && counts.MISSING === 0,
      hasMissing: counts.MISSING > 0,
    };
  });
}
