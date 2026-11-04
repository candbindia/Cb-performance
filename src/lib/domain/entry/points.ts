// Entering a point value against a KPI question — pure validation. No I/O.

export interface PointEntryInput {
  points: number;
  maxPoints: number;
  minPoints: number;
}

/** Validate a point value against its question's max/min. Returns an error, or null if OK. */
export function validatePoints(i: PointEntryInput): string | null {
  if (typeof i.points !== "number" || Number.isNaN(i.points)) return "Points must be a number";
  if (i.points > i.maxPoints) return `Points cannot exceed the max (${i.maxPoints})`;
  if (i.points < i.minPoints) return `Points cannot be below the min (${i.minPoints})`;
  // up to 2 decimals (spec §10.4)
  if (Math.round(i.points * 100) !== i.points * 100) return "Points may have at most 2 decimal places";
  return null;
}
