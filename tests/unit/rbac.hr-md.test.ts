import { describe, expect, it } from "vitest";
import { can } from "../../src/lib/domain/rbac/permissions";
import { visibleScope } from "../../src/lib/domain/rbac/scope";
import type { Principal, UserType } from "../../src/lib/domain/rbac/types";

const who = (types: UserType[], over: Partial<Principal> = {}): Principal => ({
  cabiesId: "X1",
  email: "x@candbindia.com",
  status: "ACTIVE",
  userTypes: new Set(types),
  canViewAudit: false,
  directReportIds: new Set(),
  pcUnitIds: new Set(),
  groupIds: new Set(),
  ...over,
});

describe("HR", () => {
  const hr = who(["HR"]);
  it("can manage KPI params and view the org overview", () => {
    expect(can(hr, { type: "MANAGE_KPI_PARAMS" }).allowed).toBe(true);
    expect(can(hr, { type: "VIEW_ORG_OVERVIEW" }).allowed).toBe(true);
  });
  it("can view any CABIES' appraisal", () => {
    expect(can(hr, { type: "VIEW_APPRAISAL", appraiseeId: "SOMEONE" }).allowed).toBe(true);
  });
  it("scope is everyone", () => {
    expect(visibleScope(hr)).toEqual({ kind: "ALL" });
  });
});

describe("Management (MD)", () => {
  const md = who(["MANAGEMENT"]);
  it("can view the org overview and any appraisal", () => {
    expect(can(md, { type: "VIEW_ORG_OVERVIEW" }).allowed).toBe(true);
    expect(can(md, { type: "VIEW_APPRAISAL", appraiseeId: "ANY" }).allowed).toBe(true);
  });
  it("CANNOT manage KPI params (that is HR)", () => {
    expect(can(md, { type: "MANAGE_KPI_PARAMS" })).toEqual({ allowed: false, reason: "NOT_PERMITTED" });
  });
  it("scope is everyone", () => {
    expect(visibleScope(md)).toEqual({ kind: "ALL" });
  });
});

describe("A plain CABIES has neither power", () => {
  const plain = who([]);
  it("cannot manage KPI params or see the overview", () => {
    expect(can(plain, { type: "MANAGE_KPI_PARAMS" }).allowed).toBe(false);
    expect(can(plain, { type: "VIEW_ORG_OVERVIEW" }).allowed).toBe(false);
  });
  it("still sees only their own data", () => {
    expect(visibleScope(plain)).toEqual({ kind: "IDS", ids: new Set(["X1"]) });
    expect(can(plain, { type: "VIEW_APPRAISAL", appraiseeId: "OTHER" }).allowed).toBe(false);
  });
});

describe("Someone who is both HR and PC keeps HR powers", () => {
  it("combines rights", () => {
    const both = who(["HR", "PC"], { pcUnitIds: new Set(["MC"]) });
    expect(can(both, { type: "MANAGE_KPI_PARAMS" }).allowed).toBe(true);
    expect(can(both, { type: "CREATE_PROJECT", departmentId: "MC" }).allowed).toBe(true);
  });
});
