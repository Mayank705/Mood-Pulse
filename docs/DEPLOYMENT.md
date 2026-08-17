# Deployment

## 1. Azure architecture

```
                     ┌─────────────────────────┐
Employee laptops ──▶ │  Windows Agent (Intune)  │
 (Entra ID joined)   └─────────────┬───────────┘
                                    │ HTTPS (silent SSO token)
HR / Managers ──▶ Admin Web Portal │
 (browser)          (Azure Static  │
                     Web Apps /    │
                     App Service)  │
                                    ▼
                     Azure App Service (or Container Apps)
                        Daily Pulse API (Node.js)
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
              Azure SQL DB   Microsoft Entra ID   Azure Monitor /
              (Private       (auth + JWKS)        App Insights
               Endpoint)                          (logs, audit trail)
```

Recommended resource group contents:

- **Azure SQL Database** (or SQL Managed Instance for larger orgs) — private
  endpoint, TDE (transparent data encryption) on by default.
- **Azure App Service** (Linux, Node 20 runtime) or **Azure Container Apps**
  running the API.
- **Azure Static Web Apps** (or a second App Service) for the admin portal
  build output.
- **Azure Key Vault** for `JWT_SECRET`/connection strings/Entra ID client
  secrets — reference them from App Service via Key Vault references, never
  as plaintext App Service settings in source control.
- **Azure Monitor / Application Insights** for API logs and uptime alerts.
- **Microsoft Intune** for pushing the Windows Agent to managed devices.

## 2. Switching the database to Azure SQL

The Prisma schema (`apps/api/prisma/schema.prisma`) is written to be
portable. To go from local SQLite to Azure SQL:

1. Change the datasource block:

   ```prisma
   datasource db {
     provider = "sqlserver"
     url      = env("DATABASE_URL")
   }
   ```

2. Set `DATABASE_URL` to the Azure SQL connection string:

   ```
   sqlserver://<server>.database.windows.net:1433;database=<db>;user=<user>;password=<password>;encrypt=true
   ```

   In production, prefer an Entra ID managed identity connection over a
   SQL login where your Azure SQL tier supports it.

3. Run `npx prisma migrate deploy` (not `migrate dev`) against the new
   datasource — this applies the existing migration history without
   prompting or generating a new migration, which is the correct flow for
   CI/CD.

4. Re-run `npx prisma generate` so the Prisma Client matches the new
   provider (App Service build step should already do this via
   `npm run build`, which runs `prisma generate`).

No application code changes are required — all queries go through Prisma's
query builder, not raw SQL.

## 3. Microsoft Entra ID setup

1. **App registration — API**: register `Daily Pulse API`, expose an API
   scope (e.g. `api://daily-pulse-api/access_as_employee`), and note the
   Application (client) ID — this becomes `ENTRA_CLIENT_ID` /
   `ENTRA_AUDIENCE` on the API side.
2. **App registration — Employee Agent / Admin Portal**: register one or
   two public client apps (SPA/desktop), grant them delegated permission to
   the API scope above, and set the redirect URI (for the admin portal,
   your Static Web App URL; for the Windows agent, a loopback or
   `https://login.microsoftonline.com/common/oauth2/nativeclient` URI).
3. Record the tenant ID and both client IDs into each app's environment
   configuration:
   - API: `AUTH_MODE=entra`, `ENTRA_TENANT_ID`, `ENTRA_AUDIENCE`
   - Employee/Admin frontends: `VITE_AUTH_MODE=entra`,
     `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_API_SCOPE`
4. **Complete the JWKS verification stub**: `src/auth/entraProvider.ts`
   documents the exact validation flow (fetch JWKS, match `kid`, verify
   RS256, check issuer/audience/expiry) but leaves JWK→PEM conversion as an
   explicit stub — add the `jwk-to-pem` package and implement
   `jwkToPem()` before flipping `AUTH_MODE` to `entra` in any real
   environment. This is intentionally not implemented against a fake/mock
   tenant, since a real Entra ID app registration is needed to test it
   meaningfully.
5. Sync employee hierarchy from your HR/employee master system into the
   `Employee` table (see `docs/ARCHITECTURE.md` §6), including
   `entraObjectId` so tokens can be resolved to a directory record.

## 4. Windows Employee Agent

The employee experience in this repo (`apps/web-employee`) is a small React
web app — this is the fastest path to a working, testable product in this
environment. It is designed to be wrapped as a lightweight native launcher
with minimal changes:

- **Packaging approach**: an Electron or WebView2 (Microsoft Edge
  WebView2, the lighter-weight option on Windows 10/11) shell that loads
  the built `apps/web-employee` bundle, runs as a Startup app (registered
  via Task Scheduler or the Windows Run registry key during MSI install),
  and exposes one native bridge call the web app invokes on the
  confirmation screen instead of `window.close()` — minimize/close the host
  window. That's the only integration point; everything else (auth,
  check-in logic, network calls) is unchanged web code.
- **Silent SSO**: WebView2 on an Entra ID–joined device shares the OS's
  primary refresh token, so MSAL's `ssoSilent()` resolves without a popup
  — this is what makes the agent appear with zero login friction.
- **Low footprint**: the web bundle is ~150KB gzipped; WebView2 shares the
  Edge runtime already present on managed Windows 10/11 devices, so the
  agent installer itself stays small (no bundled Chromium, unlike Electron).
- **Login-triggered launch + window policy**: Task Scheduler trigger "At
  log on", with a random 0–60s delay to avoid every laptop in the building
  hitting the API in the same second at 9:00am sharp.

## 5. Microsoft Intune deployment

1. Package the agent as an `.msi` (WiX Toolset or similar) or `.intunewin`
   via the **Microsoft Win32 Content Prep Tool**.
2. In Intune: **Apps → Windows → Add → Windows app (Win32)**, upload the
   `.intunewin` package.
3. Install command: silent MSI install (`msiexec /i DailyPulseAgent.msi
   /quiet`); detection rule: presence of the installed executable/registry
   key.
4. **Assignment**: assign as *Required* to an Entra ID group representing
   all active employee devices (ideally the same group driving your HR
   sync), so new hires' devices pick it up automatically once enrolled.
5. Configure the agent's API base URL and Entra ID client ID as an Intune
   **App Configuration Policy** (environment-specific values injected at
   install time), so the same package works across dev/staging/prod without
   rebuilding.
6. Roll out via a pilot Intune group first, then expand assignment —
   standard Intune ring deployment practice, not specific to this app.

## 6. Admin portal hosting

Build (`npm run build --workspace=apps/web-admin`) produces a static
`dist/` bundle — deploy it to **Azure Static Web Apps** (built-in CI/CD
from a GitHub repo, free TLS, easy custom domain) or any static host behind
your corporate SSO/conditional access policy. Set the three
`VITE_ENTRA_*` variables and `VITE_API_BASE_URL` at build time.

## 7. Environment variable reference

### API (`apps/api/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path (dev) or Azure SQL connection string (prod) |
| `PORT` | API port |
| `CORS_ORIGINS` | Comma-separated allowed origins (admin portal, employee agent host) |
| `APP_TIMEZONE` | Default org timezone (e.g. `Asia/Kolkata`) — overridable per-org via Settings |
| `AUTH_MODE` | `dev` (local only) or `entra` (required in production) |
| `JWT_SECRET` | Signing secret — a strong, unique value per environment, stored in Key Vault |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_AUDIENCE` | Entra ID app registration values |
| `SEED_SUPER_ADMIN_EMAIL` | Dev-only seed convenience, unused in production |

### Frontends (`apps/web-*/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API origin |
| `VITE_AUTH_MODE` | `dev` or `entra` |
| `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_API_SCOPE` | MSAL configuration |

Never commit populated `.env` files — only the checked-in `.env.example`
templates. All secrets belong in Azure Key Vault / Intune app configuration
in production.

## 8. CI/CD outline

1. `npm ci && npm test` (API test suite) on every PR.
2. `npm run build` (all three apps) as a build gate.
3. On merge to `main`: deploy API container/App Service, run
   `prisma migrate deploy` against the target Azure SQL database as a
   release step (not `migrate dev`), then deploy both frontend bundles.
