// Finding required scores that are still blank, per person. Pure: the caller does one bulk
// read of everything (params, users, groups, deptPCs, the month's full events) and passes it in.
// Whether a blank counts as "missing" (i.e. the deadline has passed) is the caller's job.

import type { ItemEvent, UserRow, GroupMemberRow, DeptPcRow } from "../../sheets/repo";
import type { KpiParamRow } from "../kpi/params";
import { resolveEffective, resolveKpiUnit } from "../kpi/params";
import { deriveAllItemStates } from "./status";
import { deptName, supportSubTeam } from "../../actions/teamQueue";

export interface MissingItem {
  cabiesId: string;
  name: string;
  designation: string;
  component: string;
  section: string;
  question: string;
  raterKind: KpiParamRow["raterKind"];
  /** Who was supposed to enter this one. */
  responsible: string;
}

export interface FindMissingInput {
  month: string;
  params: readonly KpiParamRow[];
  users: readonly UserRow[];
  groups: readonly GroupMemberRow[];
  deptPCs: readonly DeptPcRow[];
  events: readonly ItemEvent[]; // the full month's events, all people
}

export function findMissingItems(input: FindMissingInput): MissingItem[] {
  const { month, params, users, groups, deptPCs, events } = input;

  const eventsByPerson = new Map<string, ItemEvent[]>();
  for (const e of events) {
    const arr = eventsByPerson.get(e.cabiesId) ?? [];
    arr.push(e);
    eventsByPerson.set(e.cabiesId, arr);
  }

  const pcByDept = new Map(deptPCs.map((d) => [d.deptId, d.pcCabiesId]));
  const usersById = new Map(users.map((u) => [u.cabiesId, u]));

  const groupsByPerson = new Map<string, Set<string>>();
  for (const g of groups) {
    const set = groupsByPerson.get(g.cabiesId) ?? new Set<string>();
    set.add(g.group);
    groupsByPerson.set(g.cabiesId, set);
  }

  const rows = resolveEffective(params, month).filter(
    (r) => r.kind !== "TRACKER" && r.question !== "" && r.maxPoints !== null,
  );

  const missing: MissingItem[] = [];

  for (const u of users.filter((x) => x.status === "ACTIVE")) {
    let unit: string;
    try {
      unit = resolveKpiUnit(
        deptName(u.departmentId),
        u.departmentId === "SS" ? supportSubTeam(u.teamId) : undefined,
      );
    } catch {
      continue; // e.g. the MDs, no appraisal
    }

    const states = deriveAllItemStates(eventsByPerson.get(u.cabiesId) ?? []);

    for (const r of rows.filter((x) => x.unit === unit && x.designation === u.designation)) {
      // Self-rating carve-out: a GROUP item the person rates themselves is their own to enter.
      if (r.raterKind === "GROUP" && groupsByPerson.get(u.cabiesId)?.has(r.raterGroup)) continue;

      const state = states.get(r.question);
      if (state && state.status !== "NOT_ENTERED") continue; // entered, or further along

      let responsible: string;
      switch (r.raterKind) {
        case "SELF":
          responsible = u.name;
          break;
        case "RM": {
          const rm = u.rmCabiesId ? usersById.get(u.rmCabiesId) : undefined;
          responsible = rm ? rm.name : "Reporting manager (not set)";
          break;
        }
        case "GROUP":
          responsible = `${r.raterGroup} group`;
          break;
        case "PC": {
          const pcId = pcByDept.get(u.departmentId);
          const pc = pcId ? usersById.get(pcId) : undefined;
          responsible = pc ? pc.name : "PC (not assigned)";
          break;
        }
        default:
          responsible = "Unknown";
      }

      missing.push({
        cabiesId: u.cabiesId,
        name: u.name,
        designation: u.designation,
        component: r.component,
        section: r.section,
        question: r.question,
        raterKind: r.raterKind,
        responsible,
      });
    }
  }

  return missing;
}