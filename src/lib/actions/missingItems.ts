import type { SheetsRepo } from "../sheets/repo";
import type { Principal } from "../domain/rbac/types";
import { openCycle, deadlinePassed, todayIst } from "../domain/cycle/cycle";
import { findMissingItems, type MissingItem } from "../domain/entry/missing";

export interface MissingReport {
  month: string;
  entryDeadline: string;
  deadlinePassed: boolean;
  items: MissingItem[];
}

/** HR-only. Null means there's no open cycle to check right now. */
export async function loadMissingReport(
  principal: Principal,
  repo: SheetsRepo,
): Promise<MissingReport | null> {
  if (!principal.userTypes.has("HR")) throw new Error("Only HR can view missing scores.");

  const cycle = openCycle(await repo.readCycles());
  if (!cycle) return null;

  const today = todayIst();
  const passed = deadlinePassed(cycle, today);

  const [params, users, groups, deptPCs, events] = await Promise.all([
    repo.readKpiParams(),
    repo.readUsers(),
    repo.readGroups(),
    repo.readDeptPCs(),
    repo.readMonthItemEventsFull(cycle.month),
  ]);

  const items = passed
    ? findMissingItems({ month: cycle.month, params, users, groups, deptPCs, events })
    : [];

  return { month: cycle.month, entryDeadline: cycle.entryDeadline, deadlinePassed: passed, items };
}