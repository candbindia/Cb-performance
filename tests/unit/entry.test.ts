import { describe, expect, it } from "vitest";
import { validatePoints } from "../../src/lib/domain/entry/points";
import { deriveItemState, deriveAllItemStates } from "../../src/lib/domain/entry/status";
import { resolveMyQuestions } from "../../src/lib/domain/entry/myQuestions";
import { enterSelfPoint } from "../../src/lib/actions/enterPoint";
import type { KpiParamRow } from "../../src/lib/domain/kpi/params";
import type { ItemEvent, SheetsRepo } from "../../src/lib/sheets/repo";
import type { Principal } from "../../src/lib/domain/rbac/types";

describe("validatePoints", () => {
  it("accepts a value within range", () => {
    expect(validatePoints({ points: 7, maxPoints: 10, minPoints: 0 })).toBeNull();
  });
  it("rejects above max / below min", () => {
    expect(validatePoints({ points: 11, maxPoints: 10, minPoints: 0 })).toMatch(/exceed/);
    expect(validatePoints({ points: -1, maxPoints: 10, minPoints: 0 })).toMatch(/below/);
  });
  it("allows negative min (e.g. -10)", () => {
    expect(validatePoints({ points: -5, maxPoints: 10, minPoints: -10 })).toBeNull();
  });
  it("allows up to 2 decimals, rejects more", () => {
    expect(validatePoints({ points: 7.25, maxPoints: 10, minPoints: 0 })).toBeNull();
    expect(validatePoints({ points: 7.123, maxPoints: 10, minPoints: 0 })).toMatch(/2 decimal/);
  });
  it("rejects non-numbers", () => {
    expect(validatePoints({ points: NaN, maxPoints: 10, minPoints: 0 })).toMatch(/number/);
  });
});

const ev = (over: Partial<ItemEvent>): ItemEvent => ({
  eventId: "E1", at: "2026-11-06T09:00+05:30", appraisalMonth: "2026-09", cabiesId: "C1",
  instance: "VP", question: "Q1", type: "ENTER", points: 8, actorId: "C1", actorCapacity: "SELF",
  ...over,
});

describe("deriveItemState", () => {
  it("no events -> NOT_ENTERED", () => {
    expect(deriveItemState([])).toEqual({ value: null, status: "NOT_ENTERED", enteredBy: null, enteredAt: null });
  });
  it("one ENTER -> ENTERED with that value", () => {
    const s = deriveItemState([ev({})]);
    expect(s.status).toBe("ENTERED");
    expect(s.value).toBe(8);
    expect(s.enteredBy).toBe("C1");
  });
  it("ENTER then VALIDATE -> VALIDATED, keeps the entered value", () => {
    const s = deriveItemState([
      ev({ at: "2026-11-06T09:00+05:30" }),
      ev({ at: "2026-11-07T09:00+05:30", type: "VALIDATE", actorId: "MGR", actorCapacity: "VALIDATOR" }),
    ]);
    expect(s.status).toBe("VALIDATED");
    expect(s.value).toBe(8); // validator's event carries the confirmed value too, but the shown value is the latest ENTER/CORRECT
  });
  it("ENTER then SEND_BACK -> SENT_BACK", () => {
    const s = deriveItemState([ev({}), ev({ at: "2026-11-07T09:00+05:30", type: "SEND_BACK" })]);
    expect(s.status).toBe("SENT_BACK");
  });
  it("a later CORRECT replaces the shown value", () => {
    const s = deriveItemState([
      ev({ points: 8 }),
      ev({ at: "2026-11-08T09:00+05:30", type: "CORRECT", points: 6, actorId: "MGR", actorCapacity: "VALIDATOR" }),
    ]);
    expect(s.value).toBe(6);
    expect(s.status).toBe("VALIDATED");
  });
  it("AUTO_VALIDATE -> AUTO_VALIDATED", () => {
    const s = deriveItemState([ev({}), ev({ at: "2026-11-26T06:00+05:30", type: "AUTO_VALIDATE", actorId: "System", actorCapacity: "SYSTEM" })]);
    expect(s.status).toBe("AUTO_VALIDATED");
  });
  it("events out of order are still sorted by time", () => {
    const s = deriveItemState([
      ev({ at: "2026-11-07T09:00+05:30", type: "VALIDATE", actorId: "MGR", actorCapacity: "VALIDATOR" }),
      ev({ at: "2026-11-06T09:00+05:30" }),
    ]);
    expect(s.status).toBe("VALIDATED");
  });
});

describe("deriveAllItemStates", () => {
  it("groups by question", () => {
    const m = deriveAllItemStates([ev({ question: "Q1", points: 5 }), ev({ question: "Q2", points: 9 })]);
    expect(m.get("Q1")!.value).toBe(5);
    expect(m.get("Q2")!.value).toBe(9);
  });
});

const row = (over: Partial<KpiParamRow> = {}): KpiParamRow => ({
  unit: "Management Consulting", designation: "Analyst", component: "VP", projectType: "",
  effectiveFrom: "2026-09", section: "General", weightPct: 100, kind: "ITEMS",
  additionalPointsAllowed: false, question: "Attendance", maxPoints: 10, minPoints: 0,
  raterKind: "SELF", raterGroup: "", validatorGroup: "Management",
  ...over,
});

describe("resolveMyQuestions", () => {
  it("filters to the person's unit + designation, excludes TRACKER, merges state", () => {
    const params = [
      row({ question: "Q1", raterKind: "SELF" }),
      row({ question: "Q2", raterKind: "GROUP", raterGroup: "HR" }),
      row({ designation: "Manager", question: "Other role" }),
      row({ kind: "TRACKER", question: "", section: "Tracker" }),
    ];
    const states = new Map([["Q1", { value: 7, status: "ENTERED" as const, enteredBy: "C1", enteredAt: "t" }]]);
    const mine = resolveMyQuestions(params, "Management Consulting", "Analyst", "2026-09", states);
    expect(mine.map((m) => m.question)).toEqual(["Q1", "Q2"]);
    expect(mine.find((m) => m.question === "Q1")!.state.value).toBe(7);
    expect(mine.find((m) => m.question === "Q1")!.iAmTheRater).toBe(true);
    expect(mine.find((m) => m.question === "Q2")!.iAmTheRater).toBe(false);
  });

  it("resolves Support Staff by sub-team", () => {
    const params = [row({ unit: "Support - HR", designation: "Manager", question: "Recruitment" })];
    const mine = resolveMyQuestions(params, "Support Staff", "Manager", "2026-09", new Map(), "HR");
    expect(mine).toHaveLength(1);
  });
});

function fakeRepo(): SheetsRepo & { events: ItemEvent[]; pointsRows: number; audits: number } {
  const events: ItemEvent[] = [];
  let pointsRows = 0;
  let audits = 0;
  return {
    events,
    get pointsRows() { return pointsRows; },
    get audits() { return audits; },
    readUsers: async () => [], readDepartments: async () => [], readUserTypes: async () => [],
    readGroups: async () => [], readDeptPCs: async () => [], readKpiParams: async () => [],
    appendKpiParams: async () => {}, appendAudit: async (e) => { audits += e.length; },
    readItemEvents: async () => events,
    appendItemEvent: async (e) => { events.push(e); },
    upsertKpiPointsRow: async () => { pointsRows += 1; },
  };
}

const principal = (over: Partial<Principal> = {}): Principal => ({
  cabiesId: "KAVYA", email: "kavya.suresh@candbindia.com", status: "ACTIVE",
  userTypes: new Set(), canViewAudit: false,
  directReportIds: new Set(), pcUnitIds: new Set(), groupIds: new Set(),
  ...over,
});

describe("enterSelfPoint (the action)", () => {
  const base = {
    appraisalMonth: "2026-09", instance: "VP", component: "VP", project: "", section: "General",
    question: "Attendance", maxPoints: 10, minPoints: 0,
    item: { status: "NOT_ENTERED" as const, deadlinePassed: false },
    cycle: { status: "OPEN" as const },
  };

  it("writes an ItemEvent, a KPI_Points row, and an audit line", async () => {
    const repo = fakeRepo();
    await enterSelfPoint(principal(), { ...base, points: 8 }, repo, "2026-11-06T09:00+05:30");
    expect(repo.events).toHaveLength(1);
    expect(repo.events[0]!.points).toBe(8);
    expect(repo.events[0]!.actorCapacity).toBe("SELF");
    expect(repo.pointsRows).toBe(1);
    expect(repo.audits).toBe(1);
  });

  it("rejects an out-of-range value and writes nothing", async () => {
    const repo = fakeRepo();
    await expect(enterSelfPoint(principal(), { ...base, points: 99 }, repo, "t")).rejects.toThrow(/exceed/);
    expect(repo.events).toHaveLength(0);
  });

  it("refuses once the cycle is closed", async () => {
    const repo = fakeRepo();
    await expect(
      enterSelfPoint(principal(), { ...base, points: 5, cycle: { status: "CLOSED" } }, repo, "t"),
    ).rejects.toThrow(/Forbidden/);
    expect(repo.events).toHaveLength(0);
  });

  it("refuses after the deadline unless sent back", async () => {
    const repo = fakeRepo();
    await expect(
      enterSelfPoint(principal(), { ...base, points: 5, item: { status: "NOT_ENTERED", deadlinePassed: true } }, repo, "t"),
    ).rejects.toThrow(/Forbidden/);
    const repo2 = fakeRepo();
    await enterSelfPoint(principal(), { ...base, points: 5, item: { status: "SENT_BACK", deadlinePassed: true } }, repo2, "t");
    expect(repo2.events).toHaveLength(1);
  });
});
