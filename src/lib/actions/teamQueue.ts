import type { SheetsRepo } from "../sheets/repo";
import { deriveAllItemStates } from "../domain/entry/status";
import { resolveMyQuestions } from "../domain/entry/myQuestions";
import { openCycle } from "../domain/cycle/cycle";

export function deptName(id: string) {
  const names: Record<string, string> = {
    MC: "Management Consulting", CF: "Corporate Finance", IA: "Internal Audit", TX: "Taxation", SS: "Support Staff",
  };
  return names[id] ?? id;
}

/** The currently open cycle's month, or a fallback if none is open yet. */
export async function currentMonth(repo: SheetsRepo): Promise<string> {
  const cycle = openCycle(await repo.readCycles());
  return cycle?.month ?? "2026-09";
}

// Active people whose RM is this CABIES.
export async function loadReports(repo: SheetsRepo, cabiesId: string) {
  const users = await repo.readUsers();
  return users.filter((u) => u.rmCabiesId === cabiesId && u.status === "ACTIVE");
}

// The RM-rated questions for one report, with their current state.
export async function loadReportQuestions(
  repo: SheetsRepo,
  report: { cabiesId: string; departmentId: string; designation: string },
  month: string,
) {
  const [params, events] = await Promise.all([
    repo.readKpiParams(),
    repo.readItemEvents(report.cabiesId, month),
  ]);
  const states = deriveAllItemStates(events);
  return resolveMyQuestions(params, deptName(report.departmentId), report.designation, month, states)
    .filter((q) => q.raterKind === "RM");
}