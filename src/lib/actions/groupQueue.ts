// Who a GROUP rater (HR, Admin, Operations, ...) or a PC needs to grade this cycle.
// Same two-step shape as teamQueue.ts: list the reports, then load one report's questions.

import type { SheetsRepo } from "../sheets/repo";
import type { Principal } from "../domain/rbac/types";
import { deriveAllItemStates } from "../domain/entry/status";
import { resolveMyQuestions } from "../domain/entry/myQuestions";
import { resolveEffective, resolveKpiUnit } from "../domain/kpi/params";
import { deptName, supportSubTeam } from "./teamQueue";

type ActiveUser = Awaited<ReturnType<SheetsRepo["readUsers"]>>[number];

function unitFor(u: ActiveUser): string | null {
  try {
    return resolveKpiUnit(
      deptName(u.departmentId),
      u.departmentId === "SS" ? supportSubTeam(u.teamId) : undefined,
    );
  } catch {
    return null; // e.g. MDs, who have no sub-team and no appraisal
  }
}

// Active people who have at least one current GROUP item tagged with one of the
// signed-in person's own groups. Company-wide — not scoped to department or reporting
// line (decided 5 Nov). Includes the signed-in person themselves: decision B lets a
// GROUP rater grade their own items in their own group.
export async function loadGroupReports(repo: SheetsRepo, principal: Principal, month: string) {
  const [users, params] = await Promise.all([repo.readUsers(), repo.readKpiParams()]);
  const effective = resolveEffective(params, month).filter(
    (r) =>
      r.raterKind === "GROUP" &&
      r.kind !== "TRACKER" &&
      r.question !== "" &&
      r.maxPoints !== null &&
      principal.groupIds.has(r.raterGroup),
  );

  const reports: ActiveUser[] = [];
  for (const u of users.filter((x) => x.status === "ACTIVE")) {
    const unit = unitFor(u);
    if (!unit) continue;
    if (effective.some((r) => r.unit === unit && r.designation === u.designation)) {
      reports.push(u);
    }
  }
  return reports;
}

// The GROUP questions for one report that belong to the signed-in rater's own group(s).
export async function loadGroupQuestions(
  repo: SheetsRepo,
  report: { cabiesId: string; departmentId: string; teamId: string; designation: string },
  month: string,
  principal: Principal,
) {
  const [params, events] = await Promise.all([
    repo.readKpiParams(),
    repo.readItemEvents(report.cabiesId, month),
  ]);
  const states = deriveAllItemStates(events);
  const subTeam = report.departmentId === "SS" ? supportSubTeam(report.teamId) : undefined;
  return resolveMyQuestions(params, deptName(report.departmentId), report.designation, month, states, subTeam)
    .filter((q) => q.raterKind === "GROUP" && principal.groupIds.has(q.raterGroup));
}

// Active people in a department this PC covers, who have at least one current PC item.
// A PC never appears in their own list — PC self-rating has no carve-out (unlike GROUP),
// the own-appraisal guard blocks it, so there is nothing for them to open here.
export async function loadPcReports(repo: SheetsRepo, principal: Principal, month: string) {
  const [users, params] = await Promise.all([repo.readUsers(), repo.readKpiParams()]);
  const effective = resolveEffective(params, month).filter(
    (r) => r.raterKind === "PC" && r.kind !== "TRACKER" && r.question !== "" && r.maxPoints !== null,
  );

  const reports: ActiveUser[] = [];
  for (const u of users.filter(
    (x) => x.status === "ACTIVE" && x.cabiesId !== principal.cabiesId && principal.pcUnitIds.has(x.departmentId),
  )) {
    const unit = unitFor(u);
    if (!unit) continue;
    if (effective.some((r) => r.unit === unit && r.designation === u.designation)) {
      reports.push(u);
    }
  }
  return reports;
}

export async function loadPcQuestions(
  repo: SheetsRepo,
  report: { cabiesId: string; departmentId: string; teamId: string; designation: string },
  month: string,
) {
  const [params, events] = await Promise.all([
    repo.readKpiParams(),
    repo.readItemEvents(report.cabiesId, month),
  ]);
  const states = deriveAllItemStates(events);
  const subTeam = report.departmentId === "SS" ? supportSubTeam(report.teamId) : undefined;
  return resolveMyQuestions(params, deptName(report.departmentId), report.designation, month, states, subTeam)
    .filter((q) => q.raterKind === "PC");
}