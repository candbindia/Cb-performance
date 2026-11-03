// Management (MD) server action: read-only org overview.
// Orchestration only — permission check, read, aggregate.

import { assertCan } from "../domain/rbac/permissions";
import type { Principal } from "../domain/rbac/types";
import { buildOverview, type Overview } from "../domain/org/overview";
import { managementIds, type SheetsRepo } from "../sheets/repo";

export async function getOrgOverview(principal: Principal, repo: SheetsRepo): Promise<Overview> {
  assertCan(principal, { type: "VIEW_ORG_OVERVIEW" });

  const [users, departments, userTypes] = await Promise.all([
    repo.readUsers(),
    repo.readDepartments(),
    repo.readUserTypes(),
  ]);

  return buildOverview(users, departments, managementIds(userTypes));
}
