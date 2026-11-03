// KPI parameters — pure domain. Mirrors the checks the KPI_Parameters sheet runs in column T,
// plus effective-month resolution and the KPI-unit rule. No I/O.

export type Component = "VP" | "PROJECT";
export type SectionKind = "ITEMS" | "TRACKER" | "EITHER_OR";
export type RaterKind = "SELF" | "GROUP" | "PC" | "RM";

/** One KPI question (one row of KPI_Parameters). */
export interface KpiParamRow {
  unit: string;            // KPI unit: a department, or "Support - HR/Admin/Operations/PC"
  designation: string;     // Analyst | Team Lead | Manager
  component: Component;
  projectType: string;     // required for PROJECT, empty for VP
  effectiveFrom: string;   // YYYY-MM
  section: string;
  weightPct: number;
  kind: SectionKind;
  additionalPointsAllowed: boolean;
  question: string;        // blank for TRACKER sections
  maxPoints: number | null;
  minPoints: number | null;
  raterKind: RaterKind | "";
  raterGroup: string;
  validatorGroup: string;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Validate a single row the way the sheet's Row-check column does. Returns an error, or null if OK. */
export function validateRow(r: KpiParamRow): string | null {
  if (!r.unit) return "Unit is required";
  if (!r.designation) return "Designation is required";
  if (!r.component) return "Component is required";
  if (!MONTH_RE.test(r.effectiveFrom)) return "Effective from must be YYYY-MM";
  if (!r.section) return "Section is required";
  if (typeof r.weightPct !== "number" || Number.isNaN(r.weightPct)) return "Weight must be a number";
  if (r.weightPct < 0 || r.weightPct > 100) return "Weight must be between 0 and 100";
  if (!r.kind) return "Section kind is required";

  if (r.component === "PROJECT" && !r.projectType) return "PROJECT component needs a project type";
  if (r.component === "VP" && r.projectType) return "VP component must not have a project type";
  if (r.kind === "TRACKER" && r.component !== "PROJECT") return "TRACKER sections belong to PROJECT components only";
  if (r.kind === "EITHER_OR" && r.component !== "VP") return "EITHER_OR sections belong to VP components only";
  if (r.additionalPointsAllowed && !(r.component === "PROJECT" && r.kind === "ITEMS"))
    return "Additional points allowed only on ITEMS sections of PROJECT components";

  if (r.kind === "TRACKER") {
    if (r.question) return "TRACKER sections have no questions";
    return null;
  }

  // ITEMS or EITHER_OR
  if (!r.question) return "Question is required";
  if (r.maxPoints === null || r.minPoints === null) return "Max and min points are required";
  if (typeof r.maxPoints !== "number" || typeof r.minPoints !== "number") return "Max and min must be numbers";
  if (r.maxPoints <= 0) return "Max points must be above 0";
  if (r.minPoints > r.maxPoints) return "Min cannot be above max";
  if (!r.raterKind) return "Rater kind is required";
  if (r.raterKind === "GROUP" && !r.raterGroup) return "Rater group is required when rater kind is GROUP";
  if (!r.validatorGroup) return "Validator group is required";
  return null;
}

/** The key that groups rows into one "set" (one role + component + project type + effective month). */
export function setKey(r: KpiParamRow): string {
  return [r.unit, r.designation, r.component, r.projectType, r.effectiveFrom].join("|");
}
const sectionKey = (r: KpiParamRow): string => setKey(r) + "|" + r.section;

export interface SetError {
  setKey: string;
  message: string;
}

/**
 * Validate every row, then every set:
 *  - all sections in a set weigh a total of 100
 *  - a section has a single weight across its rows
 *  - a PROJECT set has exactly one TRACKER section
 * Returns a flat list of errors (empty = all good).
 */
export function validateRows(rows: readonly KpiParamRow[]): SetError[] {
  const errors: SetError[] = [];

  rows.forEach((r, i) => {
    const e = validateRow(r);
    if (e) errors.push({ setKey: setKey(r), message: `Row ${i + 1}: ${e}` });
  });

  // group by set
  const bySet = new Map<string, KpiParamRow[]>();
  for (const r of rows) {
    const k = setKey(r);
    (bySet.get(k) ?? bySet.set(k, []).get(k)!).push(r);
  }

  for (const [k, setRows] of bySet) {
    // one weight per section
    const sectionWeights = new Map<string, Set<number>>();
    for (const r of setRows) {
      const sk = sectionKey(r);
      (sectionWeights.get(sk) ?? sectionWeights.set(sk, new Set()).get(sk)!).add(r.weightPct);
    }
    let total = 0;
    for (const [sk, weights] of sectionWeights) {
      if (weights.size > 1) errors.push({ setKey: k, message: `Section "${sk.split("|").pop()}" has more than one weight` });
      total += [...weights][0] ?? 0;
    }
    if (Math.round(total * 1e6) / 1e6 !== 100)
      errors.push({ setKey: k, message: `Section weights total ${total}, must be 100` });

    // PROJECT set needs exactly one TRACKER section
    if (setRows[0]?.component === "PROJECT") {
      const trackerSections = new Set(setRows.filter((r) => r.kind === "TRACKER").map((r) => r.section));
      if (trackerSections.size !== 1)
        errors.push({ setKey: k, message: `PROJECT set must have exactly one TRACKER section (found ${trackerSections.size})` });
    }
  }
  return errors;
}

/**
 * For a given appraisal month, pick the live rows per (unit, designation, component, projectType):
 * the set whose effectiveFrom is the latest value not after the month.
 */
export function resolveEffective(rows: readonly KpiParamRow[], month: string): KpiParamRow[] {
  const roleKey = (r: KpiParamRow) => [r.unit, r.designation, r.component, r.projectType].join("|");
  const latest = new Map<string, string>(); // roleKey -> chosen effectiveFrom
  for (const r of rows) {
    if (r.effectiveFrom > month) continue;
    const rk = roleKey(r);
    const cur = latest.get(rk);
    if (cur === undefined || r.effectiveFrom > cur) latest.set(rk, r.effectiveFrom);
  }
  return rows.filter((r) => r.effectiveFrom <= month && latest.get(roleKey(r)) === r.effectiveFrom);
}

/**
 * KPI unit for a person: the department for the four main departments, and the
 * support function (its sub-team) for Support Staff, e.g. "Support - HR".
 */
export function resolveKpiUnit(departmentName: string, supportTeamName?: string): string {
  if (departmentName === "Support Staff") {
    if (!supportTeamName) throw new Error("Support Staff member needs a sub-team (HR/Admin/Operations/PC)");
    return `Support - ${supportTeamName}`;
  }
  return departmentName;
}
