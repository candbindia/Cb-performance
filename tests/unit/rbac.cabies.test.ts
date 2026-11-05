import { describe, expect, it } from "vitest";
import { can } from "../../src/lib/domain/rbac/permissions";
import { filterByScope, inScope, visibleScope } from "../../src/lib/domain/rbac/scope";
import { evaluateSignIn, type SignInFacts } from "../../src/lib/domain/rbac/signin";
import type { Action, ItemCtx, Principal } from "../../src/lib/domain/rbac/types";

const me = (over: Partial<Principal> = {}): Principal => ({
  cabiesId: "C1",
  email: "a@candbindia.com",
  status: "ACTIVE",
  userTypes: new Set(),
  canViewAudit: false,
  directReportIds: new Set(),
  pcUnitIds: new Set(),
  groupIds: new Set(),
  ...over,
});

const item = (over: Partial<ItemCtx> = {}): ItemCtx => ({
  appraiseeId: "C1",
  appraiseeDepartmentId: "D1",
  raterKind: "SELF",
  status: "NOT_ENTERED",
  deadlinePassed: false,
  ...over,
});

const enter = (i: ItemCtx, cycle: "OPEN" | "CLOSED" | "SCHEDULED" = "OPEN"): Action => ({
  type: "ENTER_ITEM",
  cycle: { status: cycle },
  item: i,
});

describe("CABIES — viewing", () => {
  const views = ["VIEW_APPRAISAL", "VIEW_HISTORY", "VIEW_STATEMENT", "VIEW_CHANGE_HISTORY"] as const;
  for (const t of views) {
    it(`${t}: own allowed, someone else's denied`, () => {
      expect(can(me(), { type: t, appraiseeId: "C1" }).allowed).toBe(true);
      expect(can(me(), { type: t, appraiseeId: "C2" })).toEqual({ allowed: false, reason: "NOT_PERMITTED" });
    });
  }
  it("inactive principal is blocked even for own data", () => {
    expect(can(me({ status: "INACTIVE" }), { type: "VIEW_APPRAISAL", appraiseeId: "C1" }).allowed).toBe(false);
  });
});

describe("CABIES — Self entry", () => {
  it("allowed before deadline in an open cycle", () => {
    expect(can(me(), enter(item())).allowed).toBe(true);
  });
  it("allowed to edit an already ENTERED value before the deadline", () => {
    expect(can(me(), enter(item({ status: "ENTERED" }))).allowed).toBe(true);
  });
  it("denied after deadline", () => {
    expect(can(me(), enter(item({ deadlinePassed: true, status: "MISSING" })))).toEqual({
      allowed: false,
      reason: "ENTRY_WINDOW_CLOSED",
    });
  });
  it("allowed after deadline only when sent back", () => {
    expect(can(me(), enter(item({ deadlinePassed: true, status: "SENT_BACK" }))).allowed).toBe(true);
  });
  it("denied once validated or auto-validated", () => {
    expect(can(me(), enter(item({ status: "VALIDATED" }))).allowed).toBe(false);
    expect(can(me(), enter(item({ status: "AUTO_VALIDATED" }))).allowed).toBe(false);
  });
  it("denied when cycle is not open", () => {
    expect(can(me(), enter(item(), "CLOSED"))).toEqual({ allowed: false, reason: "CYCLE_NOT_OPEN" });
    expect(can(me(), enter(item(), "SCHEDULED"))).toEqual({ allowed: false, reason: "CYCLE_NOT_OPEN" });
  });
  it("cannot enter someone else's Self item", () => {
    expect(can(me(), enter(item({ appraiseeId: "C2" }))).allowed).toBe(false);
  });
  it("leaver (LEFT) can still enter Self points", () => {
    expect(can(me({ status: "LEFT" }), enter(item())).allowed).toBe(true);
  });
});

describe("Own-appraisal guard", () => {
  for (const kind of ["PC", "RM"] as const) {
  it(`${kind} item on own appraisal is denied even for a CABIES who is the rater`, () => {
    expect(can(me({ groupIds: new Set(["G-HR"]) }), enter(item({ raterKind: kind, raterGroupId: "G-HR" })))).toEqual({
      allowed: false,
      reason: "OWN_APPRAISAL_GUARD",
    });
  });
}

it("GROUP item on own appraisal is allowed when the CABIES is in that rater group (decision B)", () => {
  expect(can(me({ groupIds: new Set(["G-HR"]) }), enter(item({ raterKind: "GROUP", raterGroupId: "G-HR" }))).allowed).toBe(true);
});

it("GROUP item on own appraisal is still denied when the CABIES is not in that rater group", () => {
  expect(can(me({ groupIds: new Set() }), enter(item({ raterKind: "GROUP", raterGroupId: "G-HR" })))).toEqual({
    allowed: false,
    reason: "OWN_APPRAISAL_GUARD",
  });
});
});

describe("Visibility scope", () => {
  it("CABIES sees only themselves", () => {
    const s = visibleScope(me());
    expect(inScope(s, "C1")).toBe(true);
    expect(inScope(s, "C2")).toBe(false);
  });
  it("filterByScope strips other people's rows", () => {
    const rows = [{ id: "C1" }, { id: "C2" }, { id: "C3" }];
    expect(filterByScope(rows, visibleScope(me()), (r) => r.id)).toEqual([{ id: "C1" }]);
  });
});

describe("Sign-in gate", () => {
  const base: SignInFacts = {
    email: "Asha@CandBIndia.com",
    emailVerified: true,
    allowedDomains: ["candbindia.com", "propotentia.com"],
    user: { status: "ACTIVE" },
    finalCycleClosed: false,
    bootstrapHrEmails: [],
    usersTabIsEmpty: false,
  };
  it("accepts active user on an allowed domain (case-insensitive)", () => {
    expect(evaluateSignIn(base)).toEqual({ ok: true, via: "USERS" });
  });
  it("accepts the second domain", () => {
    expect(evaluateSignIn({ ...base, email: "x@propotentia.com" }).ok).toBe(true);
  });
  it("rejects unverified email", () => {
    expect(evaluateSignIn({ ...base, emailVerified: false })).toEqual({ ok: false, reason: "EMAIL_NOT_VERIFIED" });
  });
  it("rejects other domains, incl. look-alike suffixes", () => {
    expect(evaluateSignIn({ ...base, email: "x@gmail.com" })).toEqual({ ok: false, reason: "DOMAIN_NOT_ALLOWED" });
    expect(evaluateSignIn({ ...base, email: "x@evilcandbindia.com" }).ok).toBe(false);
    expect(evaluateSignIn({ ...base, email: "x@candbindia.com.evil.io" }).ok).toBe(false);
  });
  it("rejects people not in Users", () => {
    expect(evaluateSignIn({ ...base, user: null })).toEqual({ ok: false, reason: "NOT_IN_USERS" });
  });
  it("rejects INACTIVE", () => {
    expect(evaluateSignIn({ ...base, user: { status: "INACTIVE" } })).toEqual({ ok: false, reason: "INACTIVE" });
  });
  it("LEFT keeps access until final cycle closes, then loses it", () => {
    expect(evaluateSignIn({ ...base, user: { status: "LEFT" } }).ok).toBe(true);
    expect(evaluateSignIn({ ...base, user: { status: "LEFT" }, finalCycleClosed: true })).toEqual({
      ok: false,
      reason: "LEFT_AND_FINAL_CYCLE_CLOSED",
    });
  });
  it("bootstrap HR only works while Users tab is empty", () => {
    const boot = { ...base, user: null, bootstrapHrEmails: ["asha@candbindia.com"] };
    expect(evaluateSignIn({ ...boot, usersTabIsEmpty: true })).toEqual({ ok: true, via: "BOOTSTRAP" });
    expect(evaluateSignIn({ ...boot, usersTabIsEmpty: false }).ok).toBe(false);
  });
});
