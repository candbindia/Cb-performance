// Enter (or change) a point value for one of your own SELF-rated questions.
// Orchestration only — permission check (reuses the existing CABIES/entry-window rule),
// pure validation, then two writes: the ItemEvents log (source of truth) and the readable
// KPI_Points_YYYY-MM row, plus an audit line.

import { assertCan } from "../domain/rbac/permissions";
import type { CycleCtx, ItemCtx, Principal } from "../domain/rbac/types";
import { validatePoints } from "../domain/entry/points";
import type { AuditEntry, ItemEvent, KpiPointsRow, SheetsRepo } from "../sheets/repo";

export interface EnterSelfPointInput {
  appraisalMonth: string;
  instance: string; // "VP" or "PRJ:<id>"
  component: string;
  project: string;
  section: string;
  question: string;
  points: number;
  maxPoints: number;
  minPoints: number;
  /** Current item status/deadline, so the existing entry-window rule can be applied. */
  item: Pick<ItemCtx, "status" | "deadlinePassed">;
  cycle: CycleCtx;
}

export async function enterSelfPoint(
  principal: Principal,
  input: EnterSelfPointInput,
  repo: SheetsRepo,
  now: string,
): Promise<void> {
  const itemCtx: ItemCtx = {
    appraiseeId: principal.cabiesId,
    appraiseeDepartmentId: "", // not needed for a SELF item
    raterKind: "SELF",
    status: input.item.status,
    deadlinePassed: input.item.deadlinePassed,
  };
  assertCan(principal, { type: "ENTER_ITEM", cycle: input.cycle, item: itemCtx });

  const problem = validatePoints({ points: input.points, maxPoints: input.maxPoints, minPoints: input.minPoints });
  if (problem) throw new Error(problem);

  const event: ItemEvent = {
    eventId: `${principal.cabiesId}-${input.question}-${now}`.slice(0, 64),
    at: now,
    appraisalMonth: input.appraisalMonth,
    cabiesId: principal.cabiesId,
    instance: input.instance,
    question: input.question,
    type: "ENTER",
    points: input.points,
    actorId: principal.cabiesId,
    actorCapacity: "SELF",
  };
  await repo.appendItemEvent(event);

  const row: KpiPointsRow = {
    appraisalMonth: input.appraisalMonth,
    cabiesId: principal.cabiesId,
    name: principal.email,
    component: input.component,
    project: input.project,
    section: input.section,
    question: input.question,
    points: input.points,
    maxPoints: input.maxPoints,
    status: "Entered",
    enteredBy: principal.email,
    enteredAt: now,
  };
  await repo.upsertKpiPointsRow(row);

  const audit: AuditEntry = {
    actorId: principal.cabiesId,
    actorType: "SELF",
    action: "ENTER_POINT",
    entity: "Item",
    entityId: `${principal.cabiesId}:${input.question}`,
    field: "points",
    after: String(input.points),
    at: now,
  };
  await repo.appendAudit([audit]);
}
