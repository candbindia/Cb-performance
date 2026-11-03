import { describe, expect, it } from "vitest";
import { can } from "../../src/lib/domain/rbac/permissions";
import type { Action, AssignmentCtx, ItemCtx, Principal } from "../../src/lib/domain/rbac/types";

const pc = (over: Partial<Principal> = {}): Principal => ({
  cabiesId: "PC1",
  email: "pc@candbindia.com",
  status: "ACTIVE",
  userTypes: new Set(["PC"]),
  canViewAudit: false,
  directReportIds: new Set(),
  pcUnitIds: new Set(["D1"]),
  groupIds: new Set(),
  ...over,
});

const item = (over: Partial<ItemCtx> = {}): ItemCtx => ({
  appraiseeId: "C2",
  appraiseeDepartmentId: "D1",
  raterKind: "PC",
  status: "NOT_ENTERED",
  deadlinePassed: false,
  ...over,
});

const enter = (i: ItemCtx, cycle: "OPEN" | "CLOSED" = "OPEN"): Action => ({
  type: "ENTER_ITEM",
  cycle: { status: cycle },
  item: i,
});

const open: AssignmentCtx = { cycle: { status: "OPEN" }, trackerCutoffPassed: false };

describe("PC — entering PC-rated items", () => {
  it("allowed for a CABIES in their own department", () => {
    expect(can(pc(), enter(item())).allowed).toBe(true);
  });
  it("denied for another department", () => {
    expect(can(pc(), enter(item({ appraiseeDepartmentId: "D2" })))).toEqual({
      allowed: false,
      reason: "NOT_PERMITTED",
    });
  });
  it("PC of several departments can act in each of them", () => {
    const p = pc({ pcUnitIds: new Set(["D1", "D2"]) });
    expect(can(p, enter(item({ appraiseeDepartmentId: "D2" }))).allowed).toBe(true);
  });
  it("only for PC-rated items — not RM or group items", () => {
    expect(can(pc(), enter(item({ raterKind: "RM" }))).allowed).toBe(false);
    expect(can(pc(), enter(item({ raterKind: "GROUP", raterGroupId: "G1" }))).allowed).toBe(false);
  });
  it("same entry window as any rater: deadline, sent back, validated", () => {
    expect(can(pc(), enter(item({ deadlinePassed: true, status: "MISSING" })))).toEqual({
      allowed: false,
      reason: "ENTRY_WINDOW_CLOSED",
    });
    expect(can(pc(), enter(item({ deadlinePassed: true, status: "SENT_BACK" }))).allowed).toBe(true);
    expect(can(pc(), enter(item({ status: "VALIDATED" }))).allowed).toBe(false);
  });
  it("denied when the cycle is not open", () => {
    expect(can(pc(), enter(item(), "CLOSED"))).toEqual({ allowed: false, reason: "CYCLE_NOT_OPEN" });
  });
  it("own-appraisal guard: a PC cannot rate their own PC-rated items", () => {
    expect(can(pc(), enter(item({ appraiseeId: "PC1" })))).toEqual({
      allowed: false,
      reason: "OWN_APPRAISAL_GUARD",
    });
  });
  it("a person without the PC user type gets nothing, even if listed in pcUnitIds", () => {
    expect(can(pc({ userTypes: new Set() }), enter(item())).allowed).toBe(false);
  });
  it("can still enter their own Self items (base CABIES right)", () => {
    expect(can(pc(), enter(item({ appraiseeId: "PC1", raterKind: "SELF" }))).allowed).toBe(true);
  });
});

describe("PC — projects", () => {
  it("creates projects in own department only", () => {
    expect(can(pc(), { type: "CREATE_PROJECT", departmentId: "D1" }).allowed).toBe(true);
    expect(can(pc(), { type: "CREATE_PROJECT", departmentId: "D2" }).allowed).toBe(false);
  });
  it("assigns CABIES to projects in own department while cycle open and before cut-off", () => {
    const a: Action = { type: "ASSIGN_TO_PROJECT", departmentId: "D1", targetCabiesId: "C2", ctx: open };
    expect(can(pc(), a).allowed).toBe(true);
  });
  it("cannot assign in another department", () => {
    const a: Action = { type: "ASSIGN_TO_PROJECT", departmentId: "D2", targetCabiesId: "C9", ctx: open };
    expect(can(pc(), a).allowed).toBe(false);
  });
  it("assignment blocked after the tracker cut-off", () => {
    const a: Action = {
      type: "ASSIGN_TO_PROJECT",
      departmentId: "D1",
      targetCabiesId: "C2",
      ctx: { ...open, trackerCutoffPassed: true },
    };
    expect(can(pc(), a)).toEqual({ allowed: false, reason: "TRACKER_CUTOFF_PASSED" });
  });
  it("assignment blocked when the cycle is not open", () => {
    const a: Action = {
      type: "ASSIGN_TO_PROJECT",
      departmentId: "D1",
      targetCabiesId: "C2",
      ctx: { cycle: { status: "CLOSED" }, trackerCutoffPassed: false },
    };
    expect(can(pc(), a)).toEqual({ allowed: false, reason: "CYCLE_NOT_OPEN" });
  });
  it("enables / disables project pay in own department, same window", () => {
    const base = { type: "SET_PROJECT_PAY_ENABLED", departmentId: "D1", targetCabiesId: "C2" } as const;
    expect(can(pc(), { ...base, ctx: open }).allowed).toBe(true);
    expect(can(pc(), { ...base, departmentId: "D2", ctx: open }).allowed).toBe(false);
    expect(can(pc(), { ...base, ctx: { ...open, trackerCutoffPassed: true } }).allowed).toBe(false);
  });
  it("a plain CABIES cannot create projects or assign anyone", () => {
    const plain = pc({ userTypes: new Set(), pcUnitIds: new Set() });
    expect(can(plain, { type: "CREATE_PROJECT", departmentId: "D1" }).allowed).toBe(false);
    expect(
      can(plain, { type: "ASSIGN_TO_PROJECT", departmentId: "D1", targetCabiesId: "C2", ctx: open }).allowed,
    ).toBe(false);
  });
});

describe("PC — no extra read access", () => {
  it("cannot view another CABIES' appraisal", () => {
    expect(can(pc(), { type: "VIEW_APPRAISAL", appraiseeId: "C2" }).allowed).toBe(false);
  });
});
