// HR server action: save KPI parameters into the sheet.
// Orchestration only — permission check, domain validation, write, audit.

import { assertCan } from "../domain/rbac/permissions";
import type { Principal } from "../domain/rbac/types";
import { setKey, validateRows, type KpiParamRow } from "../domain/kpi/params";
import type { AuditEntry, SheetsRepo } from "../sheets/repo";

export interface SaveResult {
  added: number;
  sets: string[]; // the set keys written
}

/**
 * HR adds a new KPI parameter set (typically one role/component for a new effective month).
 * Rejects the whole batch if any row or set fails validation — nothing partial is written.
 */
export async function saveKpiParams(
  principal: Principal,
  rows: readonly KpiParamRow[],
  repo: SheetsRepo,
  now: string,
): Promise<SaveResult> {
  assertCan(principal, { type: "MANAGE_KPI_PARAMS" });

  if (rows.length === 0) throw new Error("No rows to save");

  const errors = validateRows(rows);
  if (errors.length > 0) {
    const msg = errors.map((e) => e.message).join("; ");
    throw new ValidationError(`KPI parameters rejected: ${msg}`, errors.map((e) => e.message));
  }

  await repo.appendKpiParams(rows);

  const sets = [...new Set(rows.map(setKey))];
  const audit: AuditEntry[] = sets.map((s) => ({
    actorId: principal.cabiesId,
    actorType: "HR",
    action: "KPI_PARAMS_ADD",
    entity: "KpiParamSet",
    entityId: s,
    after: `${rows.filter((r) => setKey(r) === s).length} rows`,
    at: now,
  }));
  await repo.appendAudit(audit);

  return { added: rows.length, sets };
}

export class ValidationError extends Error {
  constructor(message: string, public readonly problems: string[]) {
    super(message);
    this.name = "ValidationError";
  }
}
