import { describe, expect, it } from "vitest";
import { approveScore } from "../../src/lib/actions/approve";
import { getTeamStatus } from "../../src/lib/actions/teamStatus";
import type { ApproveeCtx, CycleCtx, Principal } from "../../src/lib/domain/rbac/types";
import type { AuditEntry, SheetsRepo } from "../../src/lib/sheets/repo";

const who = (cabiesId: string, over: Partial<Principal> = {}): Principal => ({
  cabiesId, email: `${cabiesId}@candbindia.com`, status: "ACTIVE",
  userTypes: new Set(), canViewAudit: false,
  directReportIds: new Set(), pcUnitIds: new Set(), groupIds: new Set(),
  ...over,
});

function fakeRepo() {
  const audits: AuditEntry[] = [];
  return {
    audits,
    readUsers: async () => [], readDepartments: async () => [], readUserTypes: async () => [],
    readGroups: async () => [], readDeptPCs: async () => [], readKpiParams: async () => [],
    appendKpiParams: async () => {}, appendAudit: async (e: readonly AuditEntry[]) => { audits.push(...e); },
  } as SheetsRepo & { audits: AuditEntry[] };
}

describe("approveScore", () => {
  const open: CycleCtx = { status: "OPEN" };
  const analyst: ApproveeCtx = { appraiseeId: "KAVYA", rmCabiesId: "ARJUN", designation: "Analyst" };

  it("the own RM can approve, and it is audited", async () => {
    const repo = fakeRepo();
    const res = await approveScore(who("ARJUN"), analyst, open, "2026-09", repo, "t");
    expect(res.approvedBy).toBe("ARJUN");
    expect(repo.audits).toHaveLength(1);
    expect(repo.audits[0]!.action).toBe("APPROVE_SCORE");
  });

  it("refuses someone who is not the RM, writes nothing", async () => {
    const repo = fakeRepo();
    await expect(approveScore(who("STRANGER"), analyst, open, "2026-09", repo, "t")).rejects.toThrow(/Forbidden/);
    expect(repo.audits).toHaveLength(0);
  });
});

describe("getTeamStatus", () => {
  it("anyone may view their OWN reports' status (empty if none)", () => {
    const result = getTeamStatus(who("ARJUN"), []);
    expect(result).toEqual([]);
  });

  it("aggregates the reports passed in", () => {
    const result = getTeamStatus(who("ARJUN"), [
      { cabiesId: "KAVYA", name: "Kavya", itemStatuses: ["ENTERED", "MISSING"] },
    ]);
    expect(result[0]!.hasMissing).toBe(true);
  });
});
