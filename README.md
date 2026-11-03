# C&B Performance — Setup So Far

Status as of 3 Nov 2026. This records what's built and working, and exactly how to
rebuild the environment from scratch if needed.

---

## 1. What this is

A Next.js app that computes each CABIES's **KPI percentage** per appraisal component.
It does **not** handle pay or salary — HR does that outside the app using the percentage
it produces. Google Sheets is the database. Hosting target: Netlify Free (zero cost).

Full scope and decisions: `claude/kpi-only-plan.md` in the project.
Original spec (superseded where the plan above differs): `claude/developer-spec.md`.

---

## 2. The database — one Google Sheet

**File:** `CB_Performance_DB_SAMPLE.xlsx`, converted to a native Google Sheet (NOT left as
an uploaded .xlsx — the Sheets API cannot read Office files directly; it must be
**File → Save as Google Sheets** to get a real Sheet with its own ID).

**Sheet ID (dev):** `1guDPgOo87ae0eNm5Kyl0pJdMuuR5xmD2MS7KsWhDjI0`

**Tabs:**
| Tab | Holds | Written by |
|---|---|---|
| KPI_Parameters | KPI questions per role (unit, designation, component, section, weight, question, max/min, rater, validator) | HR, directly in the sheet |
| Departments, Teams | Org structure | HR |
| Users | CABIES directory (code, name, email, dept, team, designation, reporting manager, status) | HR |
| DeptPCs | Which PC covers which department | HR |
| Groups | Members of each rater/validator group (HR, Admin, Management, Operations) | HR |
| UserTypes | App access (HR/ADMIN/PC/MANAGEMENT) + audit-log access | HR |
| KPI_Points_YYYY-MM | Readable scores, one tab per appraisal month | the app |
| ItemEvents | Append-only log of every point entry/change (source of truth) | the app |
| AuditLog | Append-only record of every action | the app |

Real MC KPI questions were loaded from C&B's actual appraisal workbook; the rater was
read from cell colour (yellow=HR, green=Admin, blue=PC, purple=Self, no colour=RM —
the person above). Copied to the other departments; Support Staff has its own draft
set by function (HR/Admin/Operations/PC). Weights, points and validators are starter
values for HR to confirm.

**This is the DEV sheet.** For production: make a separate clean Sheet, same structure,
with the real staff list and HR's real weights/points/validators.

---

## 3. Google Cloud — service account (lets the app read/write the Sheet)

1. Cloud project `cb-performance`, **no billing account attached** (keeps it free —
   over-quota requests just get retried, never charged).
2. **Google Sheets API** enabled.
3. Service account `cb-performance-app` created, with a JSON key downloaded.
4. The Sheet is **shared with the service account's email** (the JSON's `client_email`,
   looks like `cb-performance-app@cb-performance.iam.gserviceaccount.com`) as **Editor**.
   This step is per-file — converting the sheet to a new file means re-sharing it.

---

## 4. Google Cloud — OAuth client (lets people sign in with Google)

1. Same Cloud project. **OAuth consent screen**: External (C&B has two Workspace
   domains, candbindia.com and propotentia.com — External is the safe choice unless
   confirmed they're one Workspace org, in which case Internal is simpler). Scopes:
   `openid`, `email`, `profile` only.
2. **OAuth client ID** (Web application), with redirect URI:
   `http://localhost:3000/api/auth/callback/google`

---

## 5. The repo — `cb-appraisal`

Created with `create-next-app` (TypeScript, App Router, Tailwind, `src/` directory,
`@/*` import alias). **Important:** keep the repo path free of `&` and spaces
(Windows treats `&` as a command separator and breaks npm scripts).

### Folder layout
```
cb-appraisal/
  src/
    app/
      page.tsx              home — shows role-based dashboard links
      login/page.tsx         sign-in page
      hr/page.tsx             HR dashboard (KPI parameters)
      md/page.tsx             MD dashboard (org overview)
      api/auth/[...nextauth]/route.ts
    lib/
      domain/
        rbac/                 permission engine: types, permissions, scope, signin, rules/*
        kpi/params.ts          KPI parameter validation + effective-month resolution
        org/overview.ts        org overview aggregation
      sheets/
        repo.ts                 the SheetsRepo interface (what the app depends on)
        googleRepo.ts           real Google Sheets implementation
        sampleRepo.ts           in-memory sample data (fallback / dev)
        getRepo.ts               picks sample vs real Sheet, by SHEETS_DB_ID
      actions/
        hr.ts                   saveKpiParams (HR writes parameters)
        md.ts                   getOrgOverview (MD reads the overview)
      auth/
        principal.ts            turns a signed-in email into a Principal (role) from the Sheet
        session.ts               getPrincipal() helper for pages
    auth.ts                       Auth.js config (Google provider + the sign-in gate)
    middleware.ts                 redirects signed-out visitors to /login
  tests/unit/                     82 tests (vitest)
```

### `.env.local`
```
AUTH_SECRET=<random, e.g. from node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
AUTH_GOOGLE_ID=<OAuth client ID>
AUTH_GOOGLE_SECRET=<OAuth client secret>
ALLOWED_EMAIL_DOMAINS=candbindia.com,propotentia.com
BOOTSTRAP_HR_EMAILS=<your email — lets you in before the Users tab matters, treated as HR+MANAGEMENT>
SHEETS_DB_ID=1guDPgOo87ae0eNm5Kyl0pJdMuuR5xmD2MS7KsWhDjI0
GOOGLE_SA_EMAIL=<service account client_email>
GOOGLE_SA_PRIVATE_KEY=<service account private_key, keep \n as literal backslash-n>
```

### `next.config.ts`
```ts
const nextConfig: NextConfig = {
  cacheComponents: false,   // pages that read the session can't be pre-rendered; this is required
};
```

### Dependencies installed beyond the create-next-app defaults
```
npm install next-auth@beta
npm install googleapis google-auth-library
npm install -D vitest
```

### Commands
```
npm run dev          # http://localhost:3000
npx vitest run        # 82 tests should pass
```

---

## 6. How sign-in works

1. Person clicks **Sign in with Google** → Google verifies them, no password touches
   this app.
2. The app checks, in order: email verified by Google → domain is
   `candbindia.com`/`propotentia.com` → exists as ACTIVE in the Users tab (or is in
   `BOOTSTRAP_HR_EMAILS` while Users is still being set up) → leavers keep access
   until their final month closes.
3. Once in, `buildPrincipal()` reads **Users** (designation, dept, team, RM),
   **UserTypes** (HR/ADMIN/PC/MANAGEMENT), **Groups** (rater/validator group
   membership) and **DeptPCs** (which departments a PC covers) to build the
   person's full set of rights.
4. Every action calls `can(principal, action)` on the server — the UI never decides
   what's allowed, only what to show.

---

## 7. RBA — what's built (82 tests)

| Role | Can do |
|---|---|
| Any signed-in CABIES | View only their own appraisal/history; enter their own Self scores while the cycle is open |
| HR | Manage KPI parameters (read/write); view everyone; org overview |
| Management (MD) | View the org overview; view everyone; **cannot** manage KPI parameters |
| PC | Create projects / assign people, only in their own department(s) |

Built-in guardrails: **data scope** (HR/MD see everyone, everyone else sees only
themselves — enforced server-side) and the **own-appraisal guard** (nobody acts on
their own appraisal, whatever their role).

**Not built yet, intentionally:**
- Reporting Manager rules — waiting on further detail, nothing assumed.
- Analyst / Team Lead / Manager as appraisal actors.
- Validators and the approval chain (Analyst→Team Lead→Manager→Management).
- HR's add/edit KPI parameter screen (current HR dashboard is read-only).

---

## 8. Key decisions this build follows

- Validation is a **label only** — it never blocks the calculation. An unvalidated
  item just shows "Not validated" and still counts. Only a **missing entry** blocks
  approval/close.
- Every employee gets appraised except the **MDs** (MANAGEMENT user type) — exempt,
  no scorecard.
- Once HR closes a month, scores are **frozen** — no reopen, no correction line.
- Approval chain: Analyst → Team Lead → Manager → Management, same department
  (not yet coded).

Full list of decisions and open items: `claude/kpi-only-plan.md`.

---

## 9. Quick troubleshooting log (things that bit us)

- **`&` in the folder path** breaks npm on Windows — keep the repo path plain.
- **PowerShell blocks `npx`** by default — `Set-ExecutionPolicy -Scope CurrentUser
  RemoteSigned`, or just use `cmd`.
- **`AUTH_SECRET` missing** → "MissingSecret" error — generate one, add to `.env.local`.
- **Next 16 "Cache Components" blocks the home page** (`auth()` is dynamic, can't
  prerender) → set `cacheComponents: false` in `next.config.ts`.
- **"This operation is not supported... must not be an Office file"** → the Sheet is
  still an uploaded .xlsx, not converted — use File → Save as Google Sheets.
- **"The caller does not have permission" (403)** → the service account wasn't shared
  on *this* file (a converted Sheet is a new file — re-share it), or the email in
  `.env.local` doesn't match the JSON's `client_email` exactly.
