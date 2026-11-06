// Opens a cycle: writes its Cycles row (status OPEN + deadlines), then optionally applies
// GROUP default scores in the same step — HR chooses per cycle via a checkbox, not forced.

import type { SheetsRepo } from "../sheets/repo";
import type { Principal } from "../domain/rbac/types";
import { applyGroupDefaults, type DefaultRun } from "./cycleDefaults";

export interface OpenCycleFormInput {
  month: string;
  entryDeadline: string;
  approvalDeadline: string;
  applyDefaults: boolean;
}

export interface OpenCycleResult {
  month: string;
  defaults: DefaultRun | null;
  defaultsError: string | null;
}

export async function openCycleForHr(
  principal: Principal,
  repo: SheetsRepo,
  input: OpenCycleFormInput,
  now: string,
): Promise<OpenCycleResult> {
  if (!principal.userTypes.has("HR")) throw new Error("Only HR can open a cycle.");

  await repo.upsertOpenCycle({
    month: input.month,
    entryDeadline: input.entryDeadline,
    approvalDeadline: input.approvalDeadline,
  });

  await repo.appendAudit([{
    actorId: principal.cabiesId,
    actorType: "HR",
    action: "OPEN_CYCLE",
    entity: "Cycle",
    entityId: input.month,
    after: `entry ${input.entryDeadline}, approval ${input.approvalDeadline}`,
    at: now,
  }]);

  if (!input.applyDefaults) {
    return { month: input.month, defaults: null, defaultsError: null };
  }

  try {
    const defaults = await applyGroupDefaults(principal, repo, input.month, now);
    return { month: input.month, defaults, defaultsError: null };
  } catch (e: any) {
    // The cycle is open either way — surface the defaults problem without failing the whole action.
    return { month: input.month, defaults: null, defaultsError: e.message };
  }
}