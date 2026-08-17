# Architecture

## 1. Components

```
Employee Windows Agent (Phase 2)         Web Admin Portal
   or Employee Web App (this repo)       (React + TS + Recharts)
            │                                    │
            │  HTTPS + Bearer JWT                │  HTTPS + Bearer JWT
            ▼                                    ▼
                     ASP.NET-equivalent API
              (Node.js + TypeScript + Express)
              ├─ Auth (Entra ID JWT validation)
              ├─ RBAC middleware (server-enforced)
              ├─ Mood check-in / analytics / reports services
              └─ Audit logging
                            │
                            ▼
                    Azure SQL / SQL Server
                    (Prisma ORM, portable schema)
```

Two client apps, one API, one relational database — deliberately simple.
The employee experience and the admin experience are separate deployables
that never share a codebase or a build artifact, so an employee can never
accidentally receive dashboard code.

## 2. Technology choices

| Layer          | Choice                                   | Why                                                                                                 |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Frontend         | React + TypeScript + Vite + Tailwind      | Fast dev loop, small bundles, matches the spec's suggested stack                                     |
| Charts           | Recharts                                  | Spec-suggested; simple declarative API                                                               |
| Backend          | Node.js + TypeScript + Express            | The spec asked to *evaluate* ASP.NET Core vs. Node — Node was chosen here for iteration speed in this environment; the API is a thin, framework-light REST layer, so porting the same routes/services to ASP.NET Core later is a mechanical exercise, not a redesign |
| ORM              | Prisma                                    | One schema, multiple database backends (SQLite for dev, SQL Server/Azure SQL or Postgres for prod) without rewriting queries |
| Database (dev)   | SQLite                                    | Zero infrastructure for local development and CI                                                     |
| Database (prod)  | Azure SQL / SQL Server                    | Enterprise Microsoft environment, per spec                                                           |
| Auth             | Microsoft Entra ID (MSAL + JWT/JWKS)      | Corporate SSO, per spec                                                                              |
| Hosting          | Azure                                     | Per spec — see `DEPLOYMENT.md`                                                                        |

## 3. Database schema

```
Organization 1───* Department 1───* SubDepartment
                                        │
                                        │ 1
                                        ▼ *
                                    Employee ──self-FK──▶ managerId
                                        │ 1
                                        │ *
                                        ▼
                                  MoodResponse
```

- `Employee.managerId` is a self-referencing foreign key onto `Employee` —
  a manager *is* an employee, so "Manager" is not a separate table (per the
  spec's guidance). A manager's own reports are found via
  `Employee.reports` (the inverse of `managerId`).
- **Display terminology is a UI-only layer over this schema, not a second
  data model.** This org calls `Department` a "BU", `SubDepartment` a
  "Competency", and the `MANAGER` role a "SuperCoach" — a manager's own
  manager (one hop further up `managerId`) is shown as "Co-SuperCoach",
  derived at read time (`manager.manager` in the API response), never
  stored. All of that is relabeling in `apps/web-admin/src` (see
  `ROLE_LABEL` in `types.ts` and the copy in `HierarchyFilter.tsx`,
  `Organization.tsx`, etc.) — the database tables, API routes, and request/
  response field names underneath are still `department` / `subDepartment`
  / `manager`. Deliberately kept this way rather than renaming the schema:
  it's the same risk/benefit tradeoff as any vocabulary change requested
  after the data model is live — renaming the underlying columns buys
  nothing functionally and risks a migration mistake, while a display-layer
  rename is a same-day, zero-risk change if the org's terminology shifts
  again.
- `MoodResponse` has a **database-level unique constraint on
  `(employeeId, responseDate)`** — Prisma migration
  `apps/api/prisma/migrations/*_init` — so duplicate same-day submissions
  are rejected by the database itself, not only by application logic. The
  API additionally checks this before insert so it can return a clean `409`
  instead of a raw constraint error, but the constraint is the real
  guarantee.
- `Employee.role` (`EMPLOYEE | MANAGER | HR_ADMIN | SUPER_ADMIN`) is the
  source of truth for RBAC. Enum-like fields (`role`, `mood`,
  `employmentStatus`, `AuditLog.action`) are modeled as validated strings
  rather than Prisma `enum` so the identical schema works unmodified across
  SQLite, SQL Server, and Postgres (their enum support differs); validation
  happens via `zod` at the API boundary (`src/types/enums.ts`).
- `Setting` is a single per-organization row holding the check-in window,
  mandatory/late-checkin policy, trend-detection thresholds, retention
  period, and timezone. Changing settings **never rewrites historical
  `MoodResponse` rows** — only future prompting behavior and future
  trend-window calculations change, so historical analytics stay accurate.
- `AuditLog` is append-only and records actor, action, target, metadata,
  and IP for every sensitive operation (login, mood submission, viewing an
  employee's data, exports, permission/hierarchy/settings changes).

Full schema: `apps/api/prisma/schema.prisma`.

## 4. Authentication flow

### Employee agent → API (production)

1. The employee's laptop is Entra ID–joined; on launch, the agent calls
   MSAL's `ssoSilent()`, which resolves **without showing any UI** because
   the device already has an Entra ID session. This is what makes "open
   laptop → answer one question" possible — there is no login screen in
   the steady state.
2. MSAL returns an access token scoped to the API's app registration
   (`api://<client-id>/.default`).
3. The agent calls the API with `Authorization: Bearer <token>`.
4. The API (`src/auth/entraProvider.ts`) fetches the tenant's JWKS, verifies
   the token's signature/issuer/audience/expiry, and reads the `oid`
   (object id) claim.
5. The API resolves `oid` → `Employee.entraObjectId` in the directory. If no
   match exists, the request is rejected — there is no self-service account
   creation from a token alone; employee records only ever come from the
   HR sync (§6).
6. From here on, **role and permissions are read from our own `Employee`
   row on every request**, not from Entra ID group claims — so a role
   change made by HR/Super Admin in Daily Pulse takes effect immediately,
   without waiting on an AAD group sync.

### Admin portal → API (production)

Same JWKS validation, but an interactive `loginPopup()` instead of silent
SSO (HR/managers open this app deliberately). The frontend additionally
blocks a plain `EMPLOYEE` role from ever rendering dashboard chrome — pure
UX politeness, since the API enforces the real boundary regardless.

### Local development (`AUTH_MODE=dev`)

There is no Azure tenant available in a fresh dev environment, so
`src/auth/devAuthProvider.ts` issues a normally-signed JWT (same shape and
same downstream validation code path as production) after the caller
supplies a seeded employee's email — no password, no production secret
involved. The app **refuses to start** with `AUTH_MODE=dev` when
`NODE_ENV=production` (`src/config/env.ts`), so this can't accidentally
ship.

## 5. Authorization model

Two layers, both server-side:

1. **Role → permission mapping** (`src/rbac/permissions.ts`) — coarse
   gates like "can view org-wide analytics" or "can manage settings".
2. **Resource-scoped checks** (`src/rbac/authorize.ts`) —
   `canAccessEmployee()` and `resolveManagedEmployeeIds()` walk the
   `managerId` chain to compute a manager's full reporting subtree, so a
   Manager can reach exactly their own team (and nobody else) even if they
   guess another employee's id. HR Admin / Super Admin bypass the subtree
   check (org-wide access); a plain Employee can only ever reach their own
   record.

Every route re-derives `req.user` from the database on each request
(`src/auth/middleware.ts`) — a stale or forged client-side role claim
can't grant access, because the employee's *current* row (role,
employment status) is what's checked, not whatever the token happened to
say.

## 6. Employee data synchronization

`Employee` rows are the system of record for org structure inside Daily
Pulse, and there are three supported ways to get them in, all gated on the
`hierarchy:manage` permission and all funneling through the same
create/update logic:

1. **Manual, one at a time** — `POST /api/employees` / `PUT /api/employees/:id`,
   surfaced in the Admin Portal's Employee Directory ("+ Add Employee",
   "Edit"). Same for `Department`/`SubDepartment`
   (`POST /api/departments`, `POST /api/departments/:id/sub-departments`,
   plus `PATCH`/`DELETE` for renames and removals), surfaced on the
   Organization page.
2. **Bulk, via Excel** — `POST /api/departments/import` and
   `POST /api/employees/import` accept an uploaded `.xlsx` (downloadable
   starter templates at `GET .../import/template`). Parsing and upserting
   live in `src/services/importExport.service.ts`: departments/sub-departments
   are matched by name, employees by Employee ID, so re-uploading the same
   file (with edits) safely updates rather than duplicates. Employee rows
   reference their manager by email, resolved in a second pass so row order
   in the spreadsheet doesn't matter.
3. **Bulk, via SharePoint** — `POST /api/departments/import/sharepoint` and
   `POST /api/employees/import/sharepoint` pull the same-shaped workbook
   from a SharePoint document library over Microsoft Graph
   (`src/services/sharepointSync.service.ts`) and run it through the exact
   same import logic as a manual upload. Requires a separate Graph app
   registration — see `docs/DEPLOYMENT.md`.

An employee soft-delete (`DELETE /api/employees/:id`) sets
`employmentStatus` to `TERMINATED` rather than removing the row — their
historical `MoodResponse`s, and the trends built from them, stay intact.

New employees become check-in–eligible the moment their record exists and
their `employmentStatus` is `ACTIVE` — no per-laptop configuration step.

## 7. Check-in window & once-per-day logic

`src/services/moodResponse.service.ts`:

- `getTodayStatus()` computes the org-local calendar date
  (`src/utils/timezone.ts`, timezone is a `Setting` field — never
  hard-coded — defaulting to `Asia/Kolkata`), checks whether a response
  already exists for that date, and evaluates whether "now" falls inside
  the configured `[checkinStartTime, checkinEndTime]` window or whether
  late check-ins are allowed.
- `submitMood()` rejects submissions outside the window when late
  check-ins are disabled, and relies on the database's unique
  `(employeeId, responseDate)` constraint as the final guard against
  duplicates — translating a constraint violation into an HTTP `409`.

## 8. Trend detection

`src/services/trend.service.ts` is pure, dependency-free logic (easy to
unit test) operating on an employee's `(date, moodValue)` series:

- **Repeated low responses** — N+ low-mood (`moodValue ≤ 2`) entries within
  a configurable rolling window (default: 3 in 7 days).
- **Declining trend** — the configured window is split in half; if the
  second half's average mood is meaningfully lower than the first half's,
  the trend is flagged as declining.
- **Sudden change** — the last 3 responses are all low *and* the baseline
  before them was clearly not, distinguishing a recent shift from someone
  who is simply consistently low (already covered by "repeated low").

All output strings are deliberately neutral ("Repeated low mood responses
detected", "Mood trend has declined recently", "Recent change in mood
pattern detected") — the system never labels an employee's emotional
state, per the spec's explicit requirement against pop-psychology framing.

## 9. Multi-surface readiness (Teams, mobile, Outlook)

The API has no knowledge of "Windows" or "browser" — it's a stateless REST
API authenticated via bearer tokens, so a Teams bot, a mobile client, or an
Outlook add-in can all call the same `/api/mood-responses` and
`/api/employees/:id/mood-history` endpoints without any backend change.
