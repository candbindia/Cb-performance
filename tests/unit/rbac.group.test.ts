import { describe, it, expect } from "vitest";
import { can } from "../../src/lib/domain/rbac/permissions";
import type { Principal } from "../../src/lib/domain/rbac/types";

const hrPerson: Principal = {
  cabiesId: "SS-HR1", email: "asha.menon@candbindia.com", status: "ACTIVE",
  userTypes: new Set(), canViewAudit: false,
  directReportIds: new Set(), pcUnitIds: new Set(), groupIds: new Set(["HR"]),
};

const baseItem = {
  appraiseeDepartmentId: "SS",
  status: "NOT_ENTERED" as const,
  deadlinePassed: false,
};

describe("group rater entry", () => {
  it("lets an HR group member enter another person's HR-tagged item", () => {
    const d = can(hrPerson, {
      type: "ENTER_ITEM",
      cycle: { status: "OPEN" },
      item: { ...baseItem, appraiseeId: "MC-A1", raterKind: "GROUP", raterGroupId: "HR" },
    });
    expect(d.allowed).toBe(true);
  });

  it("lets HR enter their OWN HR-tagged item (carve-out)", () => {
    const d = can(hrPerson, {
      type: "ENTER_ITEM",
      cycle: { status: "OPEN" },
      item: { ...baseItem, appraiseeId: "SS-HR1", raterKind: "GROUP", raterGroupId: "HR" },
    });
    expect(d.allowed).toBe(true);
  });

  it("still blocks HR entering their own RM-rated item", () => {
    const d = can(hrPerson, {
      type: "ENTER_ITEM",
      cycle: { status: "OPEN" },
      item: { ...baseItem, appraiseeId: "SS-HR1", raterKind: "RM", appraiseeRmCabiesId: "SS-HR1" },
    });
    expect(d.allowed).toBe(false);
  });

  it("blocks someone not in the HR group from entering an HR-tagged item", () => {
    const outsider: Principal = { ...hrPerson, cabiesId: "SS-AD1", groupIds: new Set(["Admin"]) };
    const d = can(outsider, {
      type: "ENTER_ITEM",
      cycle: { status: "OPEN" },
      item: { ...baseItem, appraiseeId: "MC-A1", raterKind: "GROUP", raterGroupId: "HR" },
    });
    expect(d.allowed).toBe(false);
  });
});