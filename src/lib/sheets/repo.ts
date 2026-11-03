// The data-access boundary. Server actions depend on THIS interface, never on Google directly,
// so the pure logic and the actions can be tested with a fake repo. The Google implementation
// lives in googleRepo.ts (isolated, not type-checked here) and is swapped in at runtime.

import type { KpiParamRow } from "../domain/kpi/params";
import type { DeptRow, UserRow } from "../domain/org/overview";

export type { KpiParamRow, DeptRow, UserRow };

/** A row for the UserTypes tab. */
export interface UserTypeRow {
  cabiesId: string;
  userType: "HR" | "ADMIN" | "PC" | "MANAGEMENT" | "SYSTEM_ADMIN";
  canViewAudit: boolean;
}

/** A row for the Groups tab (one person's membership of one group). */
export interface GroupMemberRow {
  group: string;
  cabiesId: string;
}

/** A row for the DeptPCs tab. */
export interface DeptPcRow {
  deptId: string;
  pcCabiesId: string;
}

/** One line appended to AuditLog. The repo fills seq / hash / prev_hash. */
export interface AuditEntry {
  actorId: string;
  actorType: string;
  action: string;
  entity: string;
  entityId: string;
  field?: string;
  before?: string;
  after?: string;
  reason?: string;
  at: string; // ISO 8601 +05:30
}

export interface SheetsRepo {
  readUsers(): Promise<UserRow[]>;
  readDepartments(): Promise<DeptRow[]>;
  readUserTypes(): Promise<UserTypeRow[]>;
  readGroups(): Promise<GroupMemberRow[]>;
  readDeptPCs(): Promise<DeptPcRow[]>;
  readKpiParams(): Promise<KpiParamRow[]>;
  /** Append new KPI parameter rows (a new effective-month set). */
  appendKpiParams(rows: readonly KpiParamRow[]): Promise<void>;
  appendAudit(entries: readonly AuditEntry[]): Promise<void>;
}

/** cabiesIds that have the MANAGEMENT user type — the MDs, exempt from appraisal. */
export function managementIds(userTypes: readonly UserTypeRow[]): Set<string> {
  return new Set(userTypes.filter((t) => t.userType === "MANAGEMENT").map((t) => t.cabiesId));
}
