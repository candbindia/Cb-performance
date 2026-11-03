import { describe, expect, it } from "vitest";
import {
  resolveEffective,
  resolveKpiUnit,
  validateRow,
  validateRows,
  type KpiParamRow,
} from "../../src/lib/domain/kpi/params";

const row = (over: Partial<KpiParamRow> = {}): KpiParamRow => ({
  unit: "Management Consulting",
  designation: "Analyst",
  component: "VP",
  projectType: "",
  effectiveFrom: "2026-09",
  section: "General (HR/Admin)",
  weightPct: 100,
  kind: "ITEMS",
  additionalPointsAllowed: false,
  question: "Keka regularisation",
  maxPoints: 10,
  minPoints: 0,
  raterKind: "GROUP",
  raterGroup: "HR",
  validatorGroup: "Management",
  ...over,
});

describe("validateRow", () => {
  it("accepts a good ITEMS row", () => {
    expect(validateRow(row())).toBeNull();
  });
  it("needs YYYY-MM effective month", () => {
    expect(validateRow(row({ effectiveFrom: "Sept 2026" }))).toMatch(/YYYY-MM/);
    expect(validateRow(row({ effectiveFrom: "2026-13" }))).toMatch(/YYYY-MM/);
  });
  it("PROJECT needs a project type; VP must not have one", () => {
    expect(validateRow(row({ component: "PROJECT", projectType: "", kind: "ITEMS" }))).toMatch(/project type/);
    expect(validateRow(row({ projectType: "Time-based" }))).toMatch(/must not have a project type/);
  });
  it("TRACKER only in PROJECT and carries no question", () => {
    expect(validateRow(row({ kind: "TRACKER" }))).toMatch(/TRACKER sections belong to PROJECT/);
    expect(
      validateRow(row({ component: "PROJECT", projectType: "Time-based", kind: "TRACKER", question: "x" })),
    ).toMatch(/no questions/);
    expect(
      validateRow(row({ component: "PROJECT", projectType: "Time-based", kind: "TRACKER", question: "", maxPoints: null, minPoints: null, raterKind: "", raterGroup: "", validatorGroup: "" })),
    ).toBeNull();
  });
  it("EITHER_OR only in VP", () => {
    expect(validateRow(row({ component: "PROJECT", projectType: "Time-based", kind: "EITHER_OR" }))).toMatch(/EITHER_OR/);
    expect(validateRow(row({ kind: "EITHER_OR", raterKind: "SELF", raterGroup: "" }))).toBeNull();
  });
  it("additional points only in PROJECT ITEMS", () => {
    expect(validateRow(row({ additionalPointsAllowed: true }))).toMatch(/Additional points/);
  });
  it("points rules", () => {
    expect(validateRow(row({ maxPoints: 0 }))).toMatch(/above 0/);
    expect(validateRow(row({ maxPoints: 5, minPoints: 9 }))).toMatch(/Min cannot be above max/);
    expect(validateRow(row({ minPoints: -10 }))).toBeNull(); // negatives allowed
  });
  it("GROUP rater needs a group; validator always needed", () => {
    expect(validateRow(row({ raterKind: "GROUP", raterGroup: "" }))).toMatch(/Rater group/);
    expect(validateRow(row({ validatorGroup: "" }))).toMatch(/Validator group/);
    expect(validateRow(row({ raterKind: "SELF", raterGroup: "" }))).toBeNull();
  });
});

describe("validateRows — sets", () => {
  it("accepts a VP set whose two sections total 100", () => {
    const rows = [
      row({ section: "General (HR/Admin)", weightPct: 40 }),
      row({ section: "Work", kind: "EITHER_OR", weightPct: 60, raterKind: "SELF", raterGroup: "" }),
    ];
    expect(validateRows(rows)).toEqual([]);
  });
  it("flags weights that do not total 100", () => {
    const rows = [
      row({ section: "General (HR/Admin)", weightPct: 40 }),
      row({ section: "Work", kind: "EITHER_OR", weightPct: 50, raterKind: "SELF", raterGroup: "" }),
    ];
    expect(validateRows(rows).some((e) => /total 90/.test(e.message))).toBe(true);
  });
  it("flags a section with two different weights", () => {
    const rows = [
      row({ section: "General (HR/Admin)", weightPct: 40 }),
      row({ section: "General (HR/Admin)", weightPct: 60, question: "Policy" }),
    ];
    expect(validateRows(rows).some((e) => /more than one weight/.test(e.message))).toBe(true);
  });
  it("PROJECT set must have exactly one TRACKER section", () => {
    const base = { component: "PROJECT" as const, projectType: "Time-based", designation: "Team Lead" };
    const rows = [
      row({ ...base, section: "Non-specific", kind: "ITEMS", weightPct: 100, raterKind: "SELF", raterGroup: "" }),
    ];
    expect(validateRows(rows).some((e) => /exactly one TRACKER/.test(e.message))).toBe(true);
    const ok = [
      row({ ...base, section: "Non-specific", kind: "ITEMS", weightPct: 40, raterKind: "SELF", raterGroup: "" }),
      row({ ...base, section: "Tracker", kind: "TRACKER", weightPct: 60, question: "", maxPoints: null, minPoints: null, raterKind: "", raterGroup: "", validatorGroup: "" }),
    ];
    expect(validateRows(ok)).toEqual([]);
  });
});

describe("resolveEffective", () => {
  const mk = (eff: string, q: string) => row({ effectiveFrom: eff, question: q, weightPct: 100 });
  it("picks the latest set not after the month", () => {
    const rows = [mk("2026-06", "old"), mk("2026-09", "new"), mk("2027-01", "future")];
    const got = resolveEffective(rows, "2026-10");
    expect(got.map((r) => r.question)).toEqual(["new"]);
  });
  it("different roles resolve independently", () => {
    const a = row({ designation: "Analyst", effectiveFrom: "2026-06", weightPct: 100, question: "a" });
    const b = row({ designation: "Team Lead", effectiveFrom: "2026-09", weightPct: 100, question: "b" });
    const got = resolveEffective([a, b], "2026-09");
    expect(got.map((r) => r.question).sort()).toEqual(["a", "b"]);
  });
});

describe("resolveKpiUnit", () => {
  it("main department -> its own name", () => {
    expect(resolveKpiUnit("Taxation")).toBe("Taxation");
  });
  it("Support Staff -> Support - <sub-team>", () => {
    expect(resolveKpiUnit("Support Staff", "HR")).toBe("Support - HR");
    expect(resolveKpiUnit("Support Staff", "Operations")).toBe("Support - Operations");
  });
  it("Support Staff without a sub-team throws", () => {
    expect(() => resolveKpiUnit("Support Staff")).toThrow();
  });
});
