// @ts-nocheck
// Google Sheets implementation of SheetsRepo (developer-spec §21).
// Reference implementation — runs in the app with the service-account credentials and
// `@googleapis/sheets` + `google-auth-library` installed. Excluded from this repo's typecheck
// (no googleapis here); the pure logic and actions are tested against a fake repo instead.
//
// Design notes:
//  - One spreadsheet (SHEETS_DB_ID), one tab per table (see schema below).
//  - Reads whole tabs and filters in code (tabs are small). Batch reads in one call.
//  - KPI params are append-only sets (a new effective month is new rows), so appendKpiParams
//    uses values.append. Versioning is by effective month, never by overwriting old rows.
//  - AuditLog is append-only with a hash chain; appendAudit reads the last row for seq/prev_hash.
//  - Retries 429/5xx with exponential backoff.

import { google } from "googleapis";
import { JWT } from "google-auth-library";
import crypto from "node:crypto";

const DB_ID = process.env.SHEETS_DB_ID;

const TAB = {
  users: "Users",
  departments: "Departments",
  userTypes: "UserTypes",
  groups: "Groups",
  deptPcs: "DeptPCs",
  kpiParams: "KPI_Parameters",
  audit: "AuditLog",
  cycles: "Cycles"
};

// KPI_Parameters columns A..O (helper columns P..T are sheet-only formulas, never written here).
const KPI_COLS = 15;

function authClient() {
  const key = (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  return new JWT({
    email: process.env.GOOGLE_SA_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}
const sheets = () => google.sheets({ version: "v4", auth: authClient() });

async function withRetry(fn, tries = 5) {
  let delay = 500;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = e?.code || e?.response?.status;
      if (i >= tries - 1 || ![429, 500, 502, 503, 504].includes(status)) throw e;
      await new Promise((r) => setTimeout(r, delay + Math.random() * 250));
      delay *= 2;
    }
  }
}

async function readTab(title) {
  const res = await withRetry(() =>
    sheets().spreadsheets.values.get({ spreadsheetId: DB_ID, range: `${title}` }),
  );
  const rows = res.data.values || [];
  const [header, ...body] = rows;
  return { header: header || [], body };
}

// ItemEvents and KPI_Points_* tabs carry a one-cell "note" in row 2, col A (see build_db2.py),
// which would otherwise be misread as a data row by a plain "first cell truthy" filter. A real
// data row's second column is always an ISO timestamp (e.g. "2026-11-06T09:12+05:30"); the note
// text never matches that shape, so this filter skips it safely.
const looksLikeIsoAt = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v);

async function ensureTabWithHeader(title, headers) {
  const meta = await withRetry(() => sheets().spreadsheets.get({ spreadsheetId: DB_ID }));
  const exists = (meta.data.sheets || []).some((s) => s.properties.title === title);
  if (!exists) {
    await withRetry(() =>
      sheets().spreadsheets.batchUpdate({
        spreadsheetId: DB_ID,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      }),
    );
    await withRetry(() =>
      sheets().spreadsheets.values.update({
        spreadsheetId: DB_ID,
        range: `${title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      }),
    );
  }
}

const num = (v) => (v === "" || v == null ? null : Number(v));
const yes = (v) => String(v).trim().toUpperCase() === "YES" || String(v).trim().toUpperCase() === "TRUE";

export function makeGoogleRepo() {
  return {
    async readUsers() {
  const { body } = await readTab(TAB.users);
  return body
    .filter((r) => r[0])
    .map((r) => ({
      cabiesId: r[0],
      name: r[1],
      email: r[2],              // <-- ADD THIS LINE
      departmentId: r[3],
      teamId: r[4],
      designation: r[5],
      rmCabiesId: r[6] || "",
      status: (r[8] || "ACTIVE"),
    }));
},
    async readDepartments() {
      const { body } = await readTab(TAB.departments);
      return body.filter((r) => r[0]).map((r) => ({ deptId: r[0], name: r[1] }));
    },

    async readUserTypes() {
      const { body } = await readTab(TAB.userTypes);
      return body
        .filter((r) => r[0])
        .map((r) => ({ cabiesId: r[0], userType: r[2], canViewAudit: yes(r[3]) }));
    },

    async readGroups() {
      const { body } = await readTab(TAB.groups);
      return body.filter((r) => r[0] && r[1]).map((r) => ({ group: r[0], cabiesId: r[1] }));
    },

    async readDeptPCs() {
      const { body } = await readTab(TAB.deptPcs);
      return body.filter((r) => r[0] && r[1]).map((r) => ({ deptId: r[0], pcCabiesId: r[1] }));
    },

    async readKpiParams() {
      const { body } = await readTab(TAB.kpiParams);
      return body
        .filter((r) => r[0])
        .map((r) => ({
          unit: r[0],
          designation: r[1],
          component: r[2],
          projectType: r[3] || "",
          effectiveFrom: r[4],
          section: r[5],
          weightPct: num(r[6]),
          kind: r[7],
          additionalPointsAllowed: yes(r[8]),
          question: r[9] || "",
          maxPoints: num(r[10]),
          minPoints: num(r[11]),
          raterKind: r[12] || "",
          raterGroup: r[13] || "",
          validatorGroup: r[14] || "",
        }));
    },

    async appendKpiParams(rows) {
      const values = rows.map((r) => [
        r.unit, r.designation, r.component, r.projectType, r.effectiveFrom,
        r.section, r.weightPct, r.kind, r.additionalPointsAllowed ? "YES" : "NO",
        r.question, r.maxPoints ?? "", r.minPoints ?? "", r.raterKind, r.raterGroup, r.validatorGroup,
      ].slice(0, KPI_COLS));
      await withRetry(() =>
        sheets().spreadsheets.values.append({
          spreadsheetId: DB_ID,
          range: `${TAB.kpiParams}!A:O`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        }),
      );
    },
    async readCycles() {
  const { body } = await readTab(TAB.cycles);
  return body
    .filter((r) => r[0])
    .map((r) => ({
      month: r[0],
      status: (r[1] || "UPCOMING"),
      entryDeadline: r[2] || "",
      approvalDeadline: r[3] || "",
      closedAt: r[4] || "",
    }));
},
    async readItemEvents(cabiesId, appraisalMonth) {
      const { body } = await readTab(TAB.itemEvents ?? "ItemEvents");
      return body
        .filter((r) => r[0] && looksLikeIsoAt(r[1]) && r[3] === cabiesId && r[2] === appraisalMonth)
        .map((r) => ({
          eventId: r[0], at: r[1], appraisalMonth: r[2], cabiesId: r[3], instance: r[4],
          question: r[5], type: r[6], points: Number(r[7]), actorId: r[8], actorCapacity: r[9],
          comment: r[10] || "",
        }));
    },

    async appendItemEvent(event) {
      const row = [
        event.eventId, event.at, event.appraisalMonth, event.cabiesId, event.instance,
        event.question, event.type, event.points, event.actorId, event.actorCapacity, event.comment || "",
      ];
      await withRetry(() =>
        sheets().spreadsheets.values.append({
          spreadsheetId: DB_ID,
          range: "ItemEvents!A:K",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [row] },
        }),
      );
    },

    async upsertKpiPointsRow(row) {
      const tab = `KPI_Points_${row.appraisalMonth}`;
      const headers = ["Appraisal month", "Emp code", "Name", "Component", "Project", "Section",
        "Question", "Points", "Status", "Entered by", "Entered at", "Validated by", "Validated at"];
      await ensureTabWithHeader(tab, headers);

      const { body } = await readTab(tab);
      const idx = body.findIndex((r) => r[1] === row.cabiesId && r[6] === row.question);
      const values = [row.appraisalMonth, row.cabiesId, row.name, row.component, row.project,
        row.section, row.question, row.points, row.status, row.enteredBy, row.enteredAt, "", ""];

      if (idx >= 0) {
        // +2: header row + 1-indexing
        await withRetry(() =>
          sheets().spreadsheets.values.update({
            spreadsheetId: DB_ID,
            range: `${tab}!A${idx + 2}:K${idx + 2}`,
            valueInputOption: "RAW",
            requestBody: { values: [values.slice(0, 11)] },
          }),
        );
      } else {
        await withRetry(() =>
          sheets().spreadsheets.values.append({
            spreadsheetId: DB_ID,
            range: `${tab}!A:M`,
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [values] },
          }),
        );
      }
    },

    async appendAudit(entries) {
  const { body } = await readTab(TAB.audit);
  const rows = body.filter((r) => r[0]);
  let seq = 0;
  let prev = "GENESIS";
  const last = rows[rows.length - 1];
  if (last) {
    seq = Number(last[0]);
    prev = last[13] || "GENESIS"; // column N = Hash
  }
  const values = entries.map((e) => {
    seq += 1;
    const core = [
      seq, e.at, e.actorId, e.actorType, e.action, e.entity, e.entityId,
      e.appraisalMonth || "", e.field || "", e.before || "", e.after || "", e.reason || "",
      prev, // column M = Prev hash
    ];
    const hash = crypto.createHash("sha256").update(prev + JSON.stringify(core)).digest("hex");
    prev = hash;
    return [...core, hash]; // column N = Hash
  });
  await withRetry(() =>
    sheets().spreadsheets.values.append({
      spreadsheetId: DB_ID,
      range: `${TAB.audit}!A:N`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    }),
  );
},
  };
}
