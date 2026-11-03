// RBAC types — developer-spec §14. Pure types, no I/O.

export type UserType = "HR" | "ADMIN" | "PC" | "MANAGEMENT" | "SYSTEM_ADMIN";

export type CabiesStatus = "ACTIVE" | "LEFT" | "INACTIVE";

export type RaterKind = "SELF" | "GROUP" | "PC" | "RM";

export type ItemStatus =
  | "NOT_ENTERED"
  | "MISSING"
  | "ENTERED"
  | "SENT_BACK"
  | "VALIDATED"
  | "AUTO_VALIDATED";

export type CycleStatus = "SCHEDULED" | "OPEN" | "CLOSED";

/** Who is acting. Built on the server from the session + Users/UserTypes/GroupMembers/UnitPCs tabs. */
export interface Principal {
  cabiesId: string;
  email: string;
  status: CabiesStatus;
  /** Explicit user types. Everyone is implicitly a CABIES. */
  userTypes: ReadonlySet<UserType>;
  /** Audit-log access flag from UserTypes.can_view_audit. */
  canViewAudit: boolean;
  /** Derived: cabiesIds that have this person as Reporting Manager. (Used by the RM step — not built yet.) */
  directReportIds: ReadonlySet<string>;
  /** department ids (UnitPCs.unit_id) where this person is the Project Coordinator. */
  pcUnitIds: ReadonlySet<string>;
  /** group_ids this person belongs to (rater and validator groups). */
  groupIds: ReadonlySet<string>;
}

export type DenyReason =
  | "NOT_SIGNED_IN"
  | "NOT_OWN_DATA"
  | "OWN_APPRAISAL_GUARD"
  | "NOT_THE_RATER"
  | "CYCLE_NOT_OPEN"
  | "ENTRY_WINDOW_CLOSED"
  | "TRACKER_CUTOFF_PASSED"
  | "NOT_PERMITTED";

export type Decision = { allowed: true } | { allowed: false; reason: DenyReason };

export const allow = (): Decision => ({ allowed: true });
export const deny = (reason: DenyReason): Decision => ({ allowed: false, reason });

/** Context about the cycle an action touches — supplied by the caller from the DB. */
export interface CycleCtx {
  status: CycleStatus;
}

export interface ItemCtx {
  /** The CABIES whose appraisal the item belongs to. */
  appraiseeId: string;
  /**
   * The appraisee's department id (the unit that UnitPCs refers to), already resolved by the caller.
   * The engine does not walk the org tree.
   */
  appraiseeDepartmentId: string;
  raterKind: RaterKind;
  raterGroupId?: string;
  status: ItemStatus;
  /** True once the rater's deadline day has passed (IST). */
  deadlinePassed: boolean;
}

/** Context for project assignment actions (spec §11.2: assignments can change until the tracker cut-off). */
export interface AssignmentCtx {
  cycle: CycleCtx;
  trackerCutoffPassed: boolean;
}

export type Action =
  | { type: "VIEW_APPRAISAL"; appraiseeId: string }
  | { type: "VIEW_HISTORY"; appraiseeId: string }
  | { type: "VIEW_STATEMENT"; appraiseeId: string }
  | { type: "VIEW_CHANGE_HISTORY"; appraiseeId: string }
  | { type: "ENTER_ITEM"; cycle: CycleCtx; item: ItemCtx }
  | { type: "CREATE_PROJECT"; departmentId: string }
  | { type: "ASSIGN_TO_PROJECT"; departmentId: string; targetCabiesId: string; ctx: AssignmentCtx }
  | { type: "SET_PROJECT_PAY_ENABLED"; departmentId: string; targetCabiesId: string; ctx: AssignmentCtx }
  // HR / Management (step: HR + MD)
  | { type: "MANAGE_KPI_PARAMS" } // read + write the KPI parameter sets (HR)
  | { type: "VIEW_ORG_OVERVIEW" }; // read-only company/org overview (HR, Management)

export type ActionType = Action["type"];
