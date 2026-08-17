# Security

Daily Pulse handles employee sentiment data, which is sensitive. This
document maps each requirement from the spec to its implementation.

## Authentication

- Production: Microsoft Entra ID. The API validates access tokens against
  the tenant's published JWKS (signature, issuer, audience, expiry) —
  `src/auth/entraProvider.ts`. No password is ever stored by this
  application.
- Every authenticated request re-resolves the caller's `Employee` row from
  the database (`src/auth/middleware.ts`) and rejects if the account is
  not `ACTIVE` — a terminated employee's existing token stops working
  immediately on their next request, not just at next token expiry.
- Local development only: a `dev` auth mode (disabled by a hard runtime
  check when `NODE_ENV=production`, see `src/config/env.ts`) that issues
  the same JWT shape without a password, purely so the app is runnable
  without an Azure tenant.

## Authorization (RBAC)

- Enforced **server-side, on every route** — see
  `src/rbac/permissions.ts` (role → permission mapping) and
  `src/rbac/authorize.ts` (`requirePermission`, `canAccessEmployee`,
  `resolveManagedEmployeeIds`). Frontend route/nav gating exists purely for
  UX (`RequirePermission` component, sidebar filtering) and is explicitly
  documented in code as non-authoritative — hiding a button is not a
  security control here.
- Four roles: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `SUPER_ADMIN`, matching
  the spec's capability matrix exactly (see `apps/api/tests/authz.test.ts`
  for the enforced behavior of each).
- A Manager's access is scoped to their actual reporting subtree
  (recursively resolved from `managerId`), not a hand-maintained list —
  they cannot view an employee outside their team by guessing an id.

## Encryption

- **In transit**: all client-API traffic is HTTPS in every deployed
  environment (enforced by Azure App Service/Static Web Apps TLS
  termination); `helmet()` sets standard hardening headers
  (`X-Content-Type-Options`, `X-Frame-Options`, etc.) on every API
  response.
- **At rest**: Azure SQL Database has Transparent Data Encryption (TDE) on
  by default; Azure Key Vault encrypts stored secrets at rest. No
  additional application-layer encryption is applied to `MoodResponse`
  content — access control (not additional encryption) is the primary
  protection for this data, consistent with how the rest of a typical
  Azure SQL-backed enterprise app is secured.

## Input validation & injection protection

- Every request body/query is validated with `zod` schemas before it
  reaches business logic (`src/middleware/validate.ts` and per-route
  schemas) — invalid mood values, malformed emails, out-of-range settings,
  and oversized comments (>500 chars) are rejected with `400` before
  touching the database.
- **SQL injection**: all database access goes through Prisma's
  parameterized query builder — there is no raw/string-interpolated SQL
  anywhere in the codebase.
- **XSS**: this is a React app end-to-end; React escapes all rendered
  content by default, and no component uses `dangerouslySetInnerHTML`.
  Comment text (the one significant free-text field) is rendered as plain
  text, never as HTML.
- **CSRF**: the API is a stateless bearer-token API (no cookies, no
  server-side session) called from known, CORS-restricted origins
  (`CORS_ORIGINS`) — the traditional cookie-based CSRF attack class does
  not apply to this architecture. `cors()` is configured with an explicit
  allow-list rather than a wildcard.

## Rate limiting & abuse protection

- General API rate limit (`express-rate-limit`) plus a tighter limit
  specifically on `/api/auth/*` to blunt credential/account-enumeration
  attempts (`src/app.ts`).
- Request bodies capped at 100kb.

## Audit logging

- `AuditLog` (append-only) records: login, mood submission, viewing an
  employee's data, report export, permission changes, hierarchy changes,
  and settings changes — actor, action, target, metadata, IP, and
  timestamp (`src/services/audit.service.ts`, called from every relevant
  route). Visible to `SUPER_ADMIN`/`HR_ADMIN` via `GET /api/audit-logs`
  and the Admin Portal's Audit Logs screen.

## Session handling

- No server-side session state — JWTs are short-lived (`JWT_EXPIRES_IN`,
  default 8h) and stored in `sessionStorage` (not `localStorage`) on the
  frontend, so a token does not persist across browser restarts or survive
  indefinitely on a shared device.
- `JWT_SECRET` must be a strong, unique, environment-specific value
  (enforced by a startup check that rejects the placeholder default in
  production) and belongs in Azure Key Vault, never in source control.

## Privacy-by-design

- The employee-facing UI never displays the internal 1–5 numeric mood
  score, other employees' data, historical data, dashboards, or any
  organizational information — enforced by simply not building any of
  those code paths into `apps/web-employee` (there is no admin API call
  the employee app is even capable of making).
- Trend detection output uses neutral, pattern-based language only
  ("Repeated low mood responses detected") — never a diagnostic or
  judgmental claim about an employee's mental state — enforced at the
  source in `src/services/trend.service.ts`.
- No employee rankings or "worst mood" leaderboards exist anywhere in the
  data model or UI.
- Comments are visible only to roles holding the `employee:view_comments`
  permission (`HR_ADMIN`, `SUPER_ADMIN`, and a `MANAGER` viewing their own
  team) — enforced server-side in
  `GET /api/employees/:id/mood-history`, which strips the `comment` field
  entirely from the response rather than merely hiding it in the UI.

## Data retention

- `Setting.retentionDays` is a configurable, per-organization value
  (Settings screen). Enforcing it (a scheduled purge/anonymization job) is
  intentionally left to your Azure environment's job scheduler (e.g. an
  Azure Function on a timer trigger calling a retention-cleanup service) —
  it is not yet wired to an active job in this codebase, since a real
  retention policy needs sign-off from Legal/HR on exact behavior
  (hard delete vs. anonymize) before it runs automatically against
  production data.
