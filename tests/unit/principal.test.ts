import { describe, it, expect } from "vitest";
import { buildPrincipal } from "../../src/lib/auth/principal";
import { makeSampleRepo } from "../../src/lib/sheets/sampleRepo";

const repo = makeSampleRepo();

describe("buildPrincipal", () => {
  it("matches a Users row by email, ignoring case and spaces", async () => {
    const p = await buildPrincipal("  Arjun.Nair@CandBIndia.com ", repo);
    expect(p.cabiesId).toBe("MC-TL1");
    expect(p.status).toBe("ACTIVE");
  });

  it("gives HR their user type, audit access and group", async () => {
    const p = await buildPrincipal("asha.menon@candbindia.com", repo);
    expect(p.cabiesId).toBe("SS-HR1");
    expect(p.userTypes.has("HR")).toBe(true);
    expect(p.canViewAudit).toBe(true);
    expect(p.groupIds.has("HR")).toBe(true);
  });

  it("lists a Team Lead's direct reports", async () => {
    const p = await buildPrincipal("arjun.nair@candbindia.com", repo);
    expect([...p.directReportIds].sort()).toEqual(["MC-A1", "MC-A2"]);
  });

  it("gives a PC the departments they cover", async () => {
    const p = await buildPrincipal("harish.gupta@candbindia.com", repo);
    expect(p.userTypes.has("PC")).toBe(true);
    expect([...p.pcUnitIds].sort()).toEqual(["CF", "MC"]);
  });

  it("gives an unknown email no identity and no powers", async () => {
    const p = await buildPrincipal("stranger@candbindia.com", repo);
    expect(p.cabiesId).toBe("");
    expect(p.status).toBe("INACTIVE");
    expect(p.userTypes.size).toBe(0);
  });

  it("treats a bootstrap email that is not in Users as HR + MANAGEMENT", async () => {
    const p = await buildPrincipal("boot@candbindia.com", repo, ["boot@candbindia.com"]);
    expect(p.cabiesId).toBe("BOOTSTRAP");
    expect(p.userTypes.has("HR")).toBe(true);
    expect(p.userTypes.has("MANAGEMENT")).toBe(true);
  });

  it("uses the real Users row when a bootstrap email is also in Users", async () => {
    const p = await buildPrincipal("asha.menon@candbindia.com", repo, ["asha.menon@candbindia.com"]);
    expect(p.cabiesId).toBe("SS-HR1");
    expect(p.userTypes.has("MANAGEMENT")).toBe(false);
  });
});