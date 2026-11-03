// In-memory SheetsRepo with the sample C&B data, so the app runs and the dashboards show
// real-looking content before the Google Sheet is connected. getRepo() uses this until
// SHEETS_DB_ID is set, then swaps to the Google implementation. Writes are kept in memory only.

import type { KpiParamRow } from "../domain/kpi/params";
import type { DeptRow, UserRow } from "../domain/org/overview";
import type { AuditEntry, DeptPcRow, GroupMemberRow, SheetsRepo, UserTypeRow } from "./repo";

const U = (cabiesId: string, name: string, email: string, departmentId: string, teamId: string,
  designation: string, rmCabiesId: string): UserRow =>
  ({ cabiesId, name, email, departmentId, teamId, designation, rmCabiesId, status: "ACTIVE" });

const users: UserRow[] = [
  U("MGMT1", "Rajesh Varma", "rajesh.varma@candbindia.com", "SS", "", "Manager", ""),
  U("MC-M1", "Meera Rao", "meera.rao@candbindia.com", "MC", "", "Manager", "MGMT1"),
  U("MC-TL1", "Arjun Nair", "arjun.nair@candbindia.com", "MC", "MC-ALPHA", "Team Lead", "MC-M1"),
  U("MC-A1", "Kavya Suresh", "kavya.suresh@candbindia.com", "MC", "MC-ALPHA", "Analyst", "MC-TL1"),
  U("MC-A2", "Rohit Das", "rohit.das@candbindia.com", "MC", "MC-ALPHA", "Analyst", "MC-TL1"),
  U("MC-TL2", "Sneha Iyer", "sneha.iyer@candbindia.com", "MC", "MC-BETA", "Team Lead", "MC-M1"),
  U("MC-A3", "Vikram Joshi", "vikram.joshi@candbindia.com", "MC", "MC-BETA", "Analyst", "MC-TL2"),
  U("MC-A4", "Ananya Pillai", "ananya.pillai@candbindia.com", "MC", "MC-BETA", "Analyst", "MC-TL2"),
  U("CF-M1", "Suresh Menon", "suresh.menon@candbindia.com", "CF", "", "Manager", "MGMT1"),
  U("CF-TL1", "Divya Rao", "divya.rao@candbindia.com", "CF", "CF-GAMMA", "Team Lead", "CF-M1"),
  U("CF-A1", "Karthik Venkat", "karthik.venkat@candbindia.com", "CF", "CF-GAMMA", "Analyst", "CF-TL1"),
  U("CF-A2", "Priya Nair", "priya.nair@candbindia.com", "CF", "CF-GAMMA", "Analyst", "CF-TL1"),
  U("IA-M1", "Ravi Kumar", "ravi.kumar@candbindia.com", "IA", "", "Manager", "MGMT1"),
  U("IA-TL1", "Nisha Thomas", "nisha.thomas@candbindia.com", "IA", "IA-DELTA", "Team Lead", "IA-M1"),
  U("IA-A1", "Aditya Menon", "aditya.menon@candbindia.com", "IA", "IA-DELTA", "Analyst", "IA-TL1"),
  U("IA-A2", "Sana Khan", "sana.khan@candbindia.com", "IA", "IA-DELTA", "Analyst", "IA-TL1"),
  U("TX-M1", "Lakshmi Raghavan", "lakshmi.r@candbindia.com", "TX", "", "Manager", "MGMT1"),
  U("TX-TL1", "Manoj Pillai", "manoj.pillai@candbindia.com", "TX", "TX-EPS", "Team Lead", "TX-M1"),
  U("TX-A1", "Deepak Shetty", "deepak.shetty@candbindia.com", "TX", "TX-EPS", "Analyst", "TX-TL1"),
  U("SS-HR1", "Asha Menon", "asha.menon@candbindia.com", "SS", "SS-HR", "Manager", "MGMT1"),
  U("SS-PC1", "Harish Gupta", "harish.gupta@candbindia.com", "SS", "SS-PC", "Team Lead", "SS-HR1"),
  U("SS-AD1", "Geetha Murthy", "geetha.murthy@candbindia.com", "SS", "SS-ADMIN", "Analyst", "SS-HR1"),
  U("SS-OP1", "Ramesh Tiwari", "ramesh.tiwari@candbindia.com", "SS", "SS-OPS", "Analyst", "SS-HR1"),
];

const departments: DeptRow[] = [
  { deptId: "MC", name: "Management Consulting" },
  { deptId: "CF", name: "Corporate Finance" },
  { deptId: "IA", name: "Internal Audit" },
  { deptId: "TX", name: "Taxation" },
  { deptId: "SS", name: "Support Staff" },
];

const userTypes: UserTypeRow[] = [
  { cabiesId: "MGMT1", userType: "MANAGEMENT", canViewAudit: true },
  { cabiesId: "SS-HR1", userType: "HR", canViewAudit: true },
  { cabiesId: "SS-AD1", userType: "ADMIN", canViewAudit: false },
  { cabiesId: "SS-PC1", userType: "PC", canViewAudit: false },
];

const groups: GroupMemberRow[] = [
  { group: "HR", cabiesId: "SS-HR1" },
  { group: "Admin", cabiesId: "SS-AD1" },
  { group: "Management", cabiesId: "MGMT1" },
  { group: "Operations", cabiesId: "SS-OP1" },
];

const deptPcs: DeptPcRow[] = [
  { deptId: "MC", pcCabiesId: "SS-PC1" },
  { deptId: "CF", pcCabiesId: "SS-PC1" },
];

// A few real MC Analyst parameters so the HR dashboard is not empty.
const P = (section: string, weightPct: number, kind: KpiParamRow["kind"], question: string,
  raterKind: KpiParamRow["raterKind"], raterGroup: string): KpiParamRow =>
  ({ unit: "Management Consulting", designation: "Analyst", component: "VP", projectType: "",
     effectiveFrom: "2026-09", section, weightPct, kind, additionalPointsAllowed: false, question,
     maxPoints: 10, minPoints: 0, raterKind, raterGroup, validatorGroup: "Management" });

const kpiParams: KpiParamRow[] = [
  P("General (HR/Admin)", 40, "ITEMS", "Keka regularisation within allowed timelines", "GROUP", "HR"),
  P("General (HR/Admin)", 40, "ITEMS", "Adhering to company policy and rules", "GROUP", "HR"),
  P("General (HR/Admin)", 40, "ITEMS", "Professionalism (dress code / ID / grooming)", "GROUP", "Admin"),
  P("General (HR/Admin)", 40, "ITEMS", "Verbal communication and email protocol", "PC", ""),
  P("Work (bench or project)", 60, "EITHER_OR", "Ask for task and get a project", "SELF", ""),
  P("Work (bench or project)", 60, "EITHER_OR", "Set objective and milestones; get RM confirmation", "SELF", ""),
];

export function makeSampleRepo(): SheetsRepo {
  const extraParams: KpiParamRow[] = [];
  let audits = 0;
  return {
    readUsers: async () => users,
    readDepartments: async () => departments,
    readUserTypes: async () => userTypes,
    readGroups: async () => groups,
    readDeptPCs: async () => deptPcs,
    readKpiParams: async () => [...kpiParams, ...extraParams],
    appendKpiParams: async (rows) => { extraParams.push(...rows); },
    appendAudit: async (e: readonly AuditEntry[]) => { audits += e.length; void audits; },
  };
}
