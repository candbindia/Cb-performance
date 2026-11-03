import { describe, expect, it } from "vitest";
import { can } from "../../src/lib/domain/rbac/permissions";
import { buildTeamStatus } from "../../src/lib/domain/approval/status";
import type { Action, ApproveeCtx, ItemCtx, Principal } from "../../src/lib/domain/rbac/types";

const who = (cabiesId: string, over: Partial<Principal> = {}): Principal => ({
  cabiesId,
  email: `${cabiesId}@candbindia.com`,
  status: "ACTIVE",
  userTypes: new Set(),
  canViewAudit: false,
  directReportIds: new Set(),
  pcUnitIds: new Set(),
  groupIds: new Set(),
  ...over,
});

const open = { status: "OPEN" } as const;

describe("Approval chain — own RM only", () => {
  const analyst: ApproveeCtx = { appraiseeId: "KAVYA", rmCabiesId: "ARJUN", designation: "Analyst" };

  it("the appraisee's own RM can approve", () => {
    const act: Action = { type: "APPROVE_SCORE", cycle: open, appraisee: analyst };
    expect(can(who("ARJUN"), act).allowed).toBe(true);
  });

  it("a DIFFERENT Team Lead in the same department cannot approve", () => {
    const act: Action = { type: "APPROVE_SCORE", cycle: open, appraisee: analyst };
    expect(can(who("SOME_OTHER_TL"), act).allowed).toBe(false);
  });

  it("Team Lead's score is approved by their own RM (a Manager)", () => {
    const tl: ApproveeCtx = { appraiseeId: "ARJUN", rmCabiesId: "MEERA", designation: "Team Lead" };
    const act: Action = { type: "APPROVE_SCORE", cycle: open, appraisee: tl };
    expect(can(who("MEERA"), act).allowed).toBe(true);
    expect(can(who("SOME_OTHER_MANAGER"), act).allowed).toBe(false);
  });

  it("Manager's score is approved by Management, whoever is recorded as RM", () => {
    const mgr: ApproveeCtx = { appraiseeId: "MEERA", rmCabiesId: "MGMT1", designation: "Manager" };
    const act: Action = { type: "APPROVE_SCORE", cycle: open, appraisee: mgr };
    expect(can(who("MGMT1", { userTypes: new Set(["MANAGEMENT"]) }), act).allowed).toBe(true);
    // a non-MD, even if (mis-)recorded as the RM, cannot approve a Manager
    expect(can(who("MGMT1"), act).allowed).toBe(false);
  });

  it("HR approves when there is no RM on record", () => {
    const noRm: ApproveeCtx = { appraiseeId: "ORPHAN", rmCabiesId: "", designation: "Analyst" };
    const act: Action = { type: "APPROVE_SCORE", cycle: open, appraisee: noRm };
    expect(can(who("HR1", { userTypes: new Set(["HR"]) }), act).allowed).toBe(true);
    expect(can(who("RANDOM"), act).allowed).toBe(false);
  });

  it("HR cannot approve when there IS an RM on record (own-RM rule still applies)", () => {
    const act: Action = { type: "APPROVE_SCORE", cycle: open, appraisee: analyst };
    expect(can(who("HR1", { userTypes: new Set(["HR"]) }), act).allowed).toBe(false);
  });

  it("own-appraisal guard: nobody approves themselves, even an MD approving their own Manager score", () => {
    const self: ApproveeCtx = { appraiseeId: "MGMT1", rmCabiesId: "", designation: "Manager" };
    const act: Action = { type: "APPROVE_SCORE", cycle: open, appraisee: self };
    expect(can(who("MGMT1", { userTypes: new Set(["MANAGEMENT"]) }), act)).toEqual({
      allowed: false, reason: "OWN_APPRAISAL_GUARD",
    });
  });

  it("cycle must be open", () => {
    const act: Action = { type: "APPROVE_SCORE", cycle: { status: "CLOSED" }, appraisee: analyst };
    expect(can(who("ARJUN"), act)).toEqual({ allowed: false, reason: "CYCLE_NOT_OPEN" });
  });
});

describe("RM-rated item entry", () => {
  const item = (over: Partial<ItemCtx> = {}): ItemCtx => ({
    appraiseeId: "ARJUN",
    appraiseeDepartmentId: "MC",
    appraiseeRmCabiesId: "MEERA",
    raterKind: "RM",
    status: "NOT_ENTERED",
    deadlinePassed: false,
    ...over,
  });
  const enter = (i: ItemCtx, cycle: "OPEN" | "CLOSED" = "OPEN"): Action => ({ type: "ENTER_ITEM", cycle: { status: cycle }, item: i });

  it("the named RM can enter the item", () => {
    expect(can(who("MEERA"), enter(item())).allowed).toBe(true);
  });
  it("someone who is NOT that RM cannot", () => {
    expect(can(who("SOMEONE_ELSE"), enter(item())).allowed).toBe(false);
  });
  it("own-appraisal guard still applies (can't be your own RM in practice, but guard holds)", () => {
    expect(can(who("ARJUN"), enter(item({ appraiseeId: "ARJUN", appraiseeRmCabiesId: "ARJUN" })))).toEqual({
      allowed: false, reason: "OWN_APPRAISAL_GUARD",
    });
  });
  it("same entry window as any rater", () => {
    expect(can(who("MEERA"), enter(item({ deadlinePassed: true, status: "MISSING" })))).toEqual({
      allowed: false, reason: "ENTRY_WINDOW_CLOSED",
    });
  });
  it("a Manager entering their Team Lead's RM item for the whole department works the same way", () => {
    const mgrItem = item({ appraiseeId: "ARJUN", appraiseeRmCabiesId: "MEERA" });
    expect(can(who("MEERA"), enter(mgrItem)).allowed).toBe(true);
  });
});

describe("Team status aggregation (pure)", () => {
  it("flags missing items and whether everything is entered", () => {
    const result = buildTeamStatus([
      { cabiesId: "A", name: "A", itemStatuses: ["ENTERED", "VALIDATED"] },
      { cabiesId: "B", name: "B", itemStatuses: ["ENTERED", "MISSING"] },
      { cabiesId: "C", name: "C", itemStatuses: [] },
    ]);
    expect(result.find((r) => r.cabiesId === "A")!.allEntered).toBe(true);
    expect(result.find((r) => r.cabiesId === "A")!.hasMissing).toBe(false);
    expect(result.find((r) => r.cabiesId === "B")!.hasMissing).toBe(true);
    expect(result.find((r) => r.cabiesId === "B")!.allEntered).toBe(false);
    expect(result.find((r) => r.cabiesId === "C")!.allEntered).toBe(true); // vacuously true, no items
  });
});
