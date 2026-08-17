import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",

  authMode: (process.env.AUTH_MODE ?? "dev") as "dev" | "entra",
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",

  entraTenantId: process.env.ENTRA_TENANT_ID ?? "",
  entraClientId: process.env.ENTRA_CLIENT_ID ?? "",
  entraAudience: process.env.ENTRA_AUDIENCE ?? "",

  // Microsoft Graph app registration used for the SharePoint hierarchy
  // import (src/services/sharepointSync.service.ts). Separate from the
  // Entra ID sign-in app above — this one authenticates as the service
  // itself (client-credentials), not as a signed-in user.
  graphTenantId: process.env.GRAPH_TENANT_ID ?? "",
  graphClientId: process.env.GRAPH_CLIENT_ID ?? "",
  graphClientSecret: process.env.GRAPH_CLIENT_SECRET ?? "",

  seedSuperAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@dailypulse.dev",

  isProd: (process.env.NODE_ENV ?? "development") === "production",
};

if (env.isProd && env.jwtSecret.startsWith("dev-only")) {
  throw new Error("JWT_SECRET must be set to a strong secret in production");
}

if (env.isProd && env.authMode === "dev") {
  throw new Error("AUTH_MODE must be 'entra' in production — dev auth issues unverified identities");
}
