# Daily Pulse

An internal employee engagement platform. Every employee gets one friendly
mood check-in per day; HR, managers, and admins get a role-scoped analytics
dashboard for spotting sustained sentiment trends worth a human conversation.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the system design,
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Azure/Entra ID/Intune
deployment, and [`docs/SECURITY.md`](docs/SECURITY.md) for the security
model.

## Monorepo layout

```
apps/
  api/            Node.js + TypeScript + Express + Prisma REST API
  web-employee/   React + Vite — the minimal morning check-in screen
  web-admin/      React + Vite — HR/Manager/Admin analytics dashboard
docs/             Architecture, deployment, and security documentation
```

## Prerequisites

- Node.js 20+
- npm 10+

No external database or Azure tenant is required for local development —
the API runs on SQLite and a built-in dev auth provider stands in for
Microsoft Entra ID.

## Local development

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure the API
cp apps/api/.env.example apps/api/.env

# 3. Create the database schema and load realistic demo data
npm run db:migrate
npm run db:seed

# 4. Configure the frontends (defaults already point at localhost:4000)
cp apps/web-admin/.env.example apps/web-admin/.env
cp apps/web-employee/.env.example apps/web-employee/.env

# 5. Run everything
npm run dev
```

This starts:

| App          | URL                     |
| ------------ | ----------------------- |
| API          | http://localhost:4000   |
| Admin portal | http://localhost:5173   |
| Employee app | http://localhost:5174   |

The seed script prints a Super Admin and HR Admin login email. In local dev
(`AUTH_MODE=dev`), both frontends show a "Choose an account" screen listing
every seeded employee — pick any manager/HR/admin account for the admin
portal, and any employee for the check-in app. This screen only exists in
dev mode; see below for the production auth path.

## Tests

```bash
npm test
```

Runs the API's vitest suite (34 tests) against an isolated, ephemeral SQLite
database: authentication, RBAC/authorization scoping (employee, manager,
HR admin, super admin), once-per-day and duplicate-submission handling
(including the database-level unique constraint), input validation, and
timezone handling.

## Production authentication

Local dev uses `AUTH_MODE=dev`, a JWT issued by the API itself after the
caller proves they know a seeded corporate email — there's no password
store and no production secrets involved. Production sets `AUTH_MODE=entra`
and both frontends switch to real Microsoft Entra ID sign-in via
`@azure/msal-browser`; the API validates the resulting access tokens
against the tenant's JWKS endpoint. See `docs/ARCHITECTURE.md` and
`docs/DEPLOYMENT.md` for the full flow and setup steps. The app refuses to
boot with `AUTH_MODE=dev` when `NODE_ENV=production`.

## Demo data

`npm run db:seed` generates a realistic organization: 5 departments, 2–4
sub-departments each, 2–5 managers per sub-department, 5–15 direct reports
per manager (~500+ employees total), and 35 business days of mood history
per employee with a deliberate mix of stable, improving, declining,
repeated-low, and missing-response patterns — so the dashboard's trend
detection has something real to show on first run.
