// Turn a signed-in email into a Principal, reading the Sheet via the repo.
// This is what makes "who you are" real: Google proves the email, the Sheet decides the rest.

import type { Principal, UserType } from "../domain/rbac/types";
import type { SheetsRepo } from "../sheets/repo";

const lc = (s: string) => s.trim().toLowerCase();

/**
 * Build the Principal for a signed-in email.
 *  - If the email matches a user in the Users tab, assemble from the sheet
 *    (designation/department come from Users; powers from UserTypes/Groups/DeptPCs).
 *  - Else, if the email is a bootstrap HR email, return a dev principal with HR + MANAGEMENT
 *    so the first admin can see the dashboards before anyone is in Users.
 *  - Else, a minimal principal with no powers.
 */
export async function buildPrincipal(
  email: string,
  repo: SheetsRepo,
  bootstrapHrEmails: readonly string[] = [],
): Promise<Principal> {
  const [users, userTypes, groups, deptPcs] = await Promise.all([
    repo.readUsers(),
    repo.readUserTypes(),
    repo.readGroups(),
    repo.readDeptPCs(),
  ]);

  const me = users.find((u) => lc(u.email ?? "") === lc(email));

  if (!me) {
    if (bootstrapHrEmails.map(lc).includes(lc(email))) {
      return {
        cabiesId: "BOOTSTRAP",
        email,
        status: "ACTIVE",
        userTypes: new Set<UserType>(["HR", "MANAGEMENT"]), // dev admin until Users has rows
        canViewAudit: true,
        directReportIds: new Set(),
        pcUnitIds: new Set(),
        groupIds: new Set(),
      };
    }
    return {
      cabiesId: "", email, status: "INACTIVE",
      userTypes: new Set(), canViewAudit: false,
      directReportIds: new Set(), pcUnitIds: new Set(), groupIds: new Set(),
    };
  }

  const myTypes = userTypes.filter((t) => t.cabiesId === me.cabiesId);
  return {
    cabiesId: me.cabiesId,
    email: me.email,
    status: me.status,
    userTypes: new Set(myTypes.map((t) => t.userType)),
    canViewAudit: myTypes.some((t) => t.canViewAudit),
    directReportIds: new Set(users.filter((u) => u.rmCabiesId === me.cabiesId).map((u) => u.cabiesId)),
    pcUnitIds: new Set(deptPcs.filter((d) => d.pcCabiesId === me.cabiesId).map((d) => d.deptId)),
    groupIds: new Set(groups.filter((g) => g.cabiesId === me.cabiesId).map((g) => g.group)),
  };
}
