// Resolve "my questions for this month" — the rows of KPI_Parameters that apply to one
// person, with their current entered state merged in. Pure; the caller supplies the
// already-read KPI params and item states.

import { resolveEffective, resolveKpiUnit, type KpiParamRow } from "../kpi/params";
import type { ItemState } from "./status";

export interface MyQuestion extends KpiParamRow {
  state: ItemState;
  /** True if this signed-in person is the one who enters it right now (SELF only, so far). */
  iAmTheRater: boolean;
}

export function resolveMyQuestions(
  allParams: readonly KpiParamRow[],
  departmentName: string,
  designation: string,
  month: string,
  statesByQuestion: ReadonlyMap<string, ItemState>,
  supportTeamName?: string,
): MyQuestion[] {
  const unit = resolveKpiUnit(departmentName, supportTeamName);
  const mine = resolveEffective(allParams, month).filter(
    (r) => r.unit === unit && r.designation === designation && r.kind !== "TRACKER",
  );
  return mine.map((r) => ({
    ...r,
    state: statesByQuestion.get(r.question) ?? { value: null, status: "NOT_ENTERED", enteredBy: null, enteredAt: null },
    iAmTheRater: r.raterKind === "SELF",
  }));
}
