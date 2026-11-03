// Org overview — pure aggregation for the MD's read-only dashboard. No I/O.

export interface UserRow {
  cabiesId: string;
  name: string;
  email: string;
  departmentId: string;
  teamId: string;
  designation: string;
  rmCabiesId: string;
  status: "ACTIVE" | "LEFT" | "INACTIVE";
}

export interface DeptRow {
  deptId: string;
  name: string;
}

export interface Overview {
  headcountActive: number;
  appraisedCount: number; // active, minus exempt MDs
  exemptCount: number; // active MDs (MANAGEMENT user type)
  byDepartment: { deptId: string; name: string; active: number; appraised: number }[];
  byDesignation: { designation: string; active: number }[];
}

/**
 * Build the overview from the Users and Departments tabs.
 * `managementIds` = cabiesIds with the MANAGEMENT user type; they are exempt from appraisal.
 */
export function buildOverview(
  users: readonly UserRow[],
  departments: readonly DeptRow[],
  managementIds: ReadonlySet<string>,
): Overview {
  const active = users.filter((u) => u.status === "ACTIVE");
  const isExempt = (u: UserRow) => managementIds.has(u.cabiesId);

  const deptName = new Map(departments.map((d) => [d.deptId, d.name]));
  const byDeptActive = new Map<string, number>();
  const byDeptAppraised = new Map<string, number>();
  const byDesig = new Map<string, number>();

  for (const u of active) {
    byDeptActive.set(u.departmentId, (byDeptActive.get(u.departmentId) ?? 0) + 1);
    byDesig.set(u.designation, (byDesig.get(u.designation) ?? 0) + 1);
    if (!isExempt(u)) byDeptAppraised.set(u.departmentId, (byDeptAppraised.get(u.departmentId) ?? 0) + 1);
  }

  const exemptCount = active.filter(isExempt).length;

  // keep departments in the order they appear in the Departments tab; include any unknown dept ids last
  const seen = new Set<string>();
  const byDepartment = departments.map((d) => {
    seen.add(d.deptId);
    return {
      deptId: d.deptId,
      name: d.name,
      active: byDeptActive.get(d.deptId) ?? 0,
      appraised: byDeptAppraised.get(d.deptId) ?? 0,
    };
  });
  for (const [deptId, n] of byDeptActive) {
    if (!seen.has(deptId))
      byDepartment.push({ deptId, name: deptName.get(deptId) ?? deptId, active: n, appraised: byDeptAppraised.get(deptId) ?? 0 });
  }

  return {
    headcountActive: active.length,
    appraisedCount: active.length - exemptCount,
    exemptCount,
    byDepartment,
    byDesignation: [...byDesig].map(([designation, active]) => ({ designation, active })),
  };
}
