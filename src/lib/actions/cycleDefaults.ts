
import type { SheetsRepo, ItemEvent, KpiPointsRow } from "../sheets/repo";
import type { Principal } from "../domain/rbac/types";
import { resolveEffective, resolveKpiUnit } from "../domain/kpi/params";
import { deptName, supportSubTeam } from "./teamQueue";


export interface DefaultRun {
  month: string;
  defaulted: number;
  skippedSelf: number;
}

/**
 * Writes the max score for every GROUP item of every active person, except where the person
 * is themselves in the item's rater group (they grade that one by hand — decision B, 5 Nov).
 * One batch for the ItemEvents log, one batch for KPI_Points, one audit line.
 * Refuses to run twice for the same month.
 */
export async function applyGroupDefaults(
  principal: Principal,
  repo: SheetsRepo,
  month: string,
  now: string,
): Promise<DefaultRun> {
  if (!principal.userTypes.has("HR")) throw new Error("Only HR can apply default scores.");

  const existing = await repo.readMonthItemEvents(month);
  if (existing.some((e) => e.source === "DEFAULT")) {
    throw new Error(`Defaults were already applied for ${month}.`);
  }

  const [params, users, groups] = await Promise.all([
    repo.readKpiParams(),
    repo.readUsers(),
    repo.readGroups(),
  ]);

  const groupsByPerson = new Map<string, Set<string>>();
  for (const g of groups) {
    const set = groupsByPerson.get(g.cabiesId) ?? new Set<string>();
    set.add(g.group);
    groupsByPerson.set(g.cabiesId, set);
  }

  const groupRows = resolveEffective(params, month).filter(
    (r) => r.raterKind === "GROUP" && r.kind !== "TRACKER" && r.question !== "" && r.maxPoints !== null,
  );

  const events: ItemEvent[] = [];
  const points: KpiPointsRow[] = [];
  let skippedSelf = 0;

  for (const u of users.filter((x) => x.status === "ACTIVE")) {
    let unit: string;
    try {
      unit = resolveKpiUnit(
        deptName(u.departmentId),
        u.departmentId === "SS" ? supportSubTeam(u.teamId) : undefined,
      );
    } catch {
      continue; // e.g. the MDs, who have no sub-team and no appraisal
    }

    for (const r of groupRows.filter((x) => x.unit === unit && x.designation === u.designation)) {
      if (groupsByPerson.get(u.cabiesId)?.has(r.raterGroup)) {
        skippedSelf++; // they grade this one themselves
        continue;
      }
      const max = r.maxPoints as number;
      events.push({
        eventId: `DEF-${month}-${u.cabiesId}-${events.length}`.slice(0, 64),
        at: now,
        appraisalMonth: month,
        cabiesId: u.cabiesId,
        instance: r.component,
        question: r.question,
        type: "ENTER",
        points: max,
        actorId: "SYSTEM",
        actorCapacity: "SYSTEM",
        source: "DEFAULT",
      });
      points.push({
        appraisalMonth: month,
        cabiesId: u.cabiesId,
        name: u.name,
        component: r.component,
        project: "",
        section: r.section,
        question: r.question,
        points: max,
        maxPoints: max,
        status: "Defaulted",
        enteredBy: "SYSTEM",
        enteredAt: now,
      });
    }
  }

  await repo.appendItemEvents(events);
  await repo.upsertKpiPointsRows(points);
  await repo.appendAudit([{
    actorId: principal.cabiesId,
    actorType: "HR",
    action: "APPLY_DEFAULTS",
    entity: "Cycle",
    entityId: month,
    after: `${events.length} defaults`,
    at: now,
  }]);

  return { month, defaulted: events.length, skippedSelf };
}