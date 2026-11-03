// Permission engine — developer-spec §14. Pure: no I/O.
//
// Every server action calls can(principal, action) BEFORE touching data.
// Rules per user type live in ./rules/*. They are added one user type at a time.

import { approverRule } from "./rules/approver";
import { cabiesRule } from "./rules/cabies";
import { hrRule } from "./rules/hr";
import { managementRule } from "./rules/management";
import { pcRule } from "./rules/pc";
import { rmEntryRule } from "./rules/rmEntry";
import { allow, deny, type Action, type Decision, type Principal } from "./types";

type Rule = (p: Principal, a: Action) => Decision | null;

/** Rule sets in the order they were built. Every principal gets cabiesRule (implicit CABIES). */
const RULES: readonly Rule[] = [
  cabiesRule,
  hrRule,
  managementRule,
  pcRule,
  rmEntryRule, // narrow: entering RM-rated items only — see rules/rmEntry.ts
  approverRule, // Analyst -> own RM (TL), Team Lead -> own RM (Manager), Manager -> Management; HR if no RM
  // General Reporting Manager role (team view, fill-missing, escalation) — WAITING for
  // Dinesh's details; intentionally not built.
  // Later: raterRule (Admin / group raters), validatorRule, systemAdminRule / audit.
];

/** Checks that apply to everyone, whatever their user types. */
function commonChecks(p: Principal, a: Action): Decision | null {
  if (p.status === "INACTIVE") return deny("NOT_SIGNED_IN");

  switch (a.type) {
    case "ENTER_ITEM":
      if (a.cycle.status !== "OPEN") return deny("CYCLE_NOT_OPEN");
      // Own-appraisal guard (spec §10.1): nobody enters a non-Self item on their own appraisal.
      if (a.item.raterKind !== "SELF" && a.item.appraiseeId === p.cabiesId) return deny("OWN_APPRAISAL_GUARD");
      return null;

    case "ASSIGN_TO_PROJECT":
    case "SET_PROJECT_PAY_ENABLED":
      // Spec §11.2: assignments can change until the tracker cut-off, in the open cycle.
      if (a.ctx.cycle.status !== "OPEN") return deny("CYCLE_NOT_OPEN");
      if (a.ctx.trackerCutoffPassed) return deny("TRACKER_CUTOFF_PASSED");
      return null;

    case "APPROVE_SCORE":
      if (a.cycle.status !== "OPEN") return deny("CYCLE_NOT_OPEN");
      // Own-appraisal guard: nobody approves their own score, even Management on themselves.
      if (a.appraisee.appraiseeId === p.cabiesId) return deny("OWN_APPRAISAL_GUARD");
      return null;

    default:
      return null;
  }
}

export function can(p: Principal, a: Action): Decision {
  const blocked = commonChecks(p, a);
  if (blocked) return blocked;

  let firstDeny: Decision | null = null;
  for (const rule of RULES) {
    const d = rule(p, a);
    if (!d) continue;
    if (d.allowed) return allow();
    firstDeny ??= d; // keep the most specific reason a rule gave
  }
  return firstDeny ?? deny("NOT_PERMITTED");
}

/** Throwing helper for server actions. */
export class PermissionError extends Error {
  constructor(public readonly reason: string) {
    super(`Forbidden: ${reason}`);
  }
}

export function assertCan(p: Principal, a: Action): void {
  const d = can(p, a);
  if (!d.allowed) throw new PermissionError(d.reason);
}
