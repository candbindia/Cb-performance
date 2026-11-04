import { describe, it, expect } from "vitest";
import { openCycle, entryDecision, deadlinePassed, type CycleRow } from "../../src/lib/domain/cycle/cycle";
const cycle: CycleRow = {
  month: "2026-09", status: "OPEN", entryDeadline: "2026-09-26", approvalDeadline: "2026-09-30", closedAt: "",
};

describe("cycle rules", () => {
  it("finds the open cycle", () => {
    expect(openCycle([cycle])?.month).toBe("2026-09");
  });

  it("allows entry before the deadline", () => {
    expect(entryDecision(cycle, "2026-09-20").allowed).toBe(true);
  });

  it("blocks entry after the deadline", () => {
    const d = entryDecision(cycle, "2026-09-27");
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/deadline/);
  });

  it("blocks entry when no cycle is open", () => {
    expect(entryDecision(null, "2026-09-20").allowed).toBe(false);
  });

  it("flags deadlinePassed correctly", () => {
    expect(deadlinePassed(cycle, "2026-09-25")).toBe(false);
    expect(deadlinePassed(cycle, "2026-09-27")).toBe(true);
  });
});