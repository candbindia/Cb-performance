// Data-visibility scope — developer-spec §14.3.
// Repos must apply this filter ON THE SERVER before returning rows. Never filter in the browser.

import type { Principal } from "./types";

export type Scope = { kind: "ALL" } | { kind: "IDS"; ids: ReadonlySet<string> };

/**
 * Which CABIES' appraisal data this principal may read.
 *  - HR and Management: everyone.
 *  - Everyone else (so far): only themselves.
 *  - Later: RM gains their direct reports.
 */
export function visibleScope(p: Principal): Scope {
  if (p.userTypes.has("HR") || p.userTypes.has("MANAGEMENT")) return { kind: "ALL" };
  return { kind: "IDS", ids: new Set([p.cabiesId]) };
}

export function inScope(scope: Scope, cabiesId: string): boolean {
  return scope.kind === "ALL" || scope.ids.has(cabiesId);
}

/** Filter any rows carrying a cabies id. */
export function filterByScope<T>(rows: readonly T[], scope: Scope, idOf: (row: T) => string): T[] {
  return scope.kind === "ALL" ? [...rows] : rows.filter((r) => scope.ids.has(idOf(r)));
}
