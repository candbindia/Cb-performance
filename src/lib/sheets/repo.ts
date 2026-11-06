// The data-access boundary. Server actions depend on THIS interface, never on Google directly,
// so the pure logic and the actions can be tested with a fake repo. The Google implementation
// lives in googleRepo.ts (isolated, not type-checked here) and is swapped in at runtime.

import type { KpiParamRow } from "../domain/kpi/params";
import type { DeptRow, UserRow } from "../domain/org/overview";
import type { CycleRow } from "../domain/cycle/cycle";
export type { CycleRow };

export type { KpiParamRow, DeptRow, UserRow };

/** A row for the UserTypes tab. */
export interface UserTypeRow {
  cabiesId: string;
  userType: "HR" | "ADMIN" | "PC" | "MANAGEMENT" | "SYSTEM_ADMIN";
  canViewAudit: boolean;
}


export interface OpenCycleInput {
  month: string; // "YYYY-MM"
  entryDeadline: string; // "YYYY-MM-DD"
  approvalDeadline: string; // "YYYY-MM-DD"
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

/** One row appended to ItemEvents — the append-only source of truth for points. */
export interface ItemEvent {
  eventId: string;
  at: string;
  appraisalMonth: string;
  cabiesId: string;
  instance: string;
  question: string;
  type: "ENTER" | "RM_FILL" | "VALIDATE" | "CORRECT" | "SEND_BACK" | "AUTO_VALIDATE";
  points: number;
  actorId: string;
  actorCapacity: string; // SELF | RATER | VALIDATOR | SYSTEM
  comment?: string;
  /** DEFAULT = written by the system at cycle open; ENTERED = typed in by a person. Missing means ENTERED. */
  source?: "DEFAULT" | "ENTERED";
}


/** One row in the readable per-month KPI_Points_YYYY-MM tab (mirrors an ItemEvent). */
export interface KpiPointsRow {
  appraisalMonth: string;
  cabiesId: string;
  name: string;
  component: string;
  project: string;
  section: string;
  question: string;
  points: number;
  maxPoints: number;
  status: string;
  enteredBy: string;
  enteredAt: string;
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

  /** Every ItemEvent for one CABIES in one appraisal month (so the UI can show current values). */
  readItemEvents(cabiesId: string, appraisalMonth: string): Promise<ItemEvent[]>;
  /** Append one point entry to the source-of-truth log. */
  appendItemEvent(event: ItemEvent): Promise<void>;
  
    /** Append many point entries in one request (used for the cycle-open default write). */
  appendItemEvents(events: readonly ItemEvent[]): Promise<void>;
  /** Upsert many KPI_Points rows: one read per month tab, one batch update, one append. */
  upsertKpiPointsRows(rows: readonly KpiPointsRow[]): Promise<void>;
    /** Create or update a Cycles row: sets status OPEN and the given deadlines, clears closedAt. */
  upsertOpenCycle(input: OpenCycleInput): Promise<void>;
  /**
   * Upsert one row of the readable KPI_Points_YYYY-MM tab (creating the tab if this is its
   * first row). Keyed by (cabiesId, question): a later call for the same pair replaces it,
   * rather than appending a duplicate — this tab is a current-value view, not a log.
   */
  upsertKpiPointsRow(row: KpiPointsRow): Promise<void>;
    /** Every row of the Cycles tab — one per appraisal month. */
  readCycles(): Promise<CycleRow[]>;

    /** Every ItemEvent for one appraisal month, all people (used to check whether defaults already ran). */
  readMonthItemEvents(
    appraisalMonth: string,
  ): Promise<Pick<ItemEvent, "eventId" | "appraisalMonth" | "cabiesId" | "source">[]>;
}

/** cabiesIds that have the MANAGEMENT user type — the MDs, exempt from appraisal. */
export function managementIds(userTypes: readonly UserTypeRow[]): Set<string> {
  return new Set(userTypes.filter((t) => t.userType === "MANAGEMENT").map((t) => t.cabiesId));
}

