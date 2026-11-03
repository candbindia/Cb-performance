import { describe, expect, it, vi } from "vitest";
import { saveKpiParams, ValidationError } from "../../src/lib/actions/hr";
import { getOrgOverview } from "../../src/lib/actions/md";
import type { KpiParamRow } from "../../src/lib/domain/kpi/params";
import type { Principal, UserType } from "../../src/lib/domain/rbac/types";
import type { DeptRow, SheetsRepo, UserRow, UserTypeRow } from "../../src/lib/sheets/repo";

const who = (types: UserType[]): Principal => ({
  cabiesId: "HR1", email: "hr@candbindia.com", status: "ACTIVE",
  userTypes: new Set(types), canViewAudit: false,
  directReportIds: new Set(), pcUnitIds: new Set(), groupIds: new Set(),
});

function fakeRepo(seed: Partial<{
  users: UserRow[]; departments: DeptRow[]; userTypes: UserTypeRow[]; kpi: KpiParamRow[];
}> = {}): SheetsRepo & { appended: KpiParamRow[]; audits: number } {
  const state = { appended: [] as KpiParamRow[], audits: 0 };
  return {
    appended: state.appended,
    get audits() { return state.audits; },
    readUsers: async () => seed.users ?? [],
    readDepartments: async () => seed.departments ?? [],
    readUserTypes: async () => seed.userTypes ?? [],
    readKpiParams: async () => seed.kpi ?? [],
    appendKpiParams: async (rows) => { state.appended.push(...rows); },
    appendAudit: async (e) => { state.audits += e.length; },
  };
}

const vpSet = (): KpiParamRow[] => [
  { unit: "Management Consulting", designation: "Analyst", component: "VP", projectType: "", effectiveFrom: "2026-12",
    section: "General", weightPct: 40, kind: "ITEMS", additionalPointsAllowed: false, question: "Attendance",
    maxPoints: 10, minPoints: 0, raterKind: "GROUP", raterGroup: "HR", validatorGroup: "Management" },
  { unit: "Management Consulting", designation: "Analyst", component: "VP", projectType: "", effectiveFrom: "2026-12",
    section: "Work", weightPct: 60, kind: "EITHER_OR", additionalPointsAllowed: false, question: "Bench task",
    maxPoints: 10, minPoints: 0, raterKind: "SELF", raterGroup: "", validatorGroup: "Management" },
];

describe("saveKpiParams (HR)", () => {
  it("writes a valid set and appends audit", async () => {
    const repo = fakeRepo();
    const res = await saveKpiParams(who(["HR"]), vpSet(), repo, "2026-11-03T10:00:00+05:30");
    expect(res.added).toBe(2);
    expect(res.sets).toHaveLength(1);
    expect(repo.appended).toHaveLength(2);
    expect(repo.audits).toBe(1);
  });

  it("rejects a set whose weights do not total 100 and writes nothing", async () => {
    const repo = fakeRepo();
    const bad = vpSet();
    bad[1]!.weightPct = 50;
    await expect(saveKpiParams(who(["HR"]), bad, repo, "t")).rejects.toBeInstanceOf(ValidationError);
    expect(repo.appended).toHaveLength(0);
    expect(repo.audits).toBe(0);
  });

  it("refuses a non-HR principal before touching the repo", async () => {
    const repo = fakeRepo();
    const spy = vi.spyOn(repo, "appendKpiParams");
    await expect(saveKpiParams(who(["MANAGEMENT"]), vpSet(), repo, "t")).rejects.toThrow(/Forbidden/);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("getOrgOverview (MD)", () => {
  const users: UserRow[] = [
    { cabiesId: "MGMT1", name: "MD", departmentId: "SS", teamId: "", designation: "Manager", rmCabiesId: "", status: "ACTIVE" },
    { cabiesId: "MC-M1", name: "Mgr", departmentId: "MC", teamId: "", designation: "Manager", rmCabiesId: "MGMT1", status: "ACTIVE" },
    { cabiesId: "MC-A1", name: "An", departmentId: "MC", teamId: "MC-A", designation: "Analyst", rmCabiesId: "MC-M1", status: "ACTIVE" },
    { cabiesId: "OLD", name: "Gone", departmentId: "MC", teamId: "MC-A", designation: "Analyst", rmCabiesId: "MC-M1", status: "LEFT" },
  ];
  const departments: DeptRow[] = [{ deptId: "MC", name: "Management Consulting" }, { deptId: "SS", name: "Support Staff" }];
  const userTypes: UserTypeRow[] = [{ cabiesId: "MGMT1", userType: "MANAGEMENT", canViewAudit: true }];

  it("counts active staff, exempts the MD, and breaks down by department", async () => {
    const repo = fakeRepo({ users, departments, userTypes });
    const ov = await getOrgOverview(who(["MANAGEMENT"]), repo);
    expect(ov.headcountActive).toBe(3); // OLD is LEFT
    expect(ov.exemptCount).toBe(1); // the MD
    expect(ov.appraisedCount).toBe(2);
    const mc = ov.byDepartment.find((d) => d.deptId === "MC")!;
    expect(mc.active).toBe(2);
    expect(mc.appraised).toBe(2);
    const ss = ov.byDepartment.find((d) => d.deptId === "SS")!;
    expect(ss.active).toBe(1);
    expect(ss.appraised).toBe(0); // only the exempt MD
  });

  it("refuses a plain CABIES", async () => {
    const repo = fakeRepo({ users, departments, userTypes });
    await expect(getOrgOverview(who([]), repo)).rejects.toThrow(/Forbidden/);
  });
});
