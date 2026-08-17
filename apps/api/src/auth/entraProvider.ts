import jwt, { JwtHeader } from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Production auth path: validates a Microsoft Entra ID access token.
 *
 * Flow:
 *  1. Frontend uses @azure/msal-browser to sign the employee in against the
 *     corporate tenant and acquire an access token for this API's app
 *     registration (api://<ENTRA_CLIENT_ID>).
 *  2. Frontend sends it as `Authorization: Bearer <token>`.
 *  3. This module fetches the tenant's signing keys from its OIDC discovery
 *     document, verifies the token's RS256 signature, issuer, audience and
 *     expiry, and returns the decoded claims.
 *  4. `authenticate` middleware (auth/middleware.ts) then maps the token's
 *     `oid` claim to our Employee.entraObjectId to resolve the internal
 *     employee record and role — the source of truth for role stays in our
 *     own directory (synced from the HR system), not in Entra ID group
 *     claims, so role changes take effect without waiting on IT to update
 *     AAD group membership.
 *
 * Keys are cached for 10 minutes to avoid hitting the discovery endpoint on
 * every request.
 */

interface JwkKey {
  kid: string;
  n: string;
  e: string;
  x5c?: string[];
}

let cachedKeys: { keys: JwkKey[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function getSigningKeys(): Promise<JwkKey[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < CACHE_TTL_MS) {
    return cachedKeys.keys;
  }
  const jwksUrl = `https://login.microsoftonline.com/${env.entraTenantId}/discovery/v2.0/keys`;
  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error(`Failed to fetch Entra ID signing keys: ${res.status}`);
  const body = (await res.json()) as { keys: JwkKey[] };
  cachedKeys = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

function jwkToPem(_key: JwkKey): string {
  // In production, use a small helper (e.g. `jwk-to-pem`) to convert the
  // JWKS RSA components to PEM before calling jwt.verify. Omitted here to
  // avoid an extra runtime dependency in a repo whose default AUTH_MODE is
  // "dev" — add `jwk-to-pem` when enabling AUTH_MODE=entra.
  throw new Error(
    "entraProvider.jwkToPem is a documented stub — install `jwk-to-pem` and implement the JWK->PEM " +
      "conversion before setting AUTH_MODE=entra in production."
  );
}

export interface EntraClaims {
  oid: string;
  preferred_username?: string;
  email?: string;
  name: string;
  aud: string;
  iss: string;
}

export async function verifyEntraToken(token: string): Promise<EntraClaims> {
  const decodedHeader = jwt.decode(token, { complete: true })?.header as JwtHeader | undefined;
  if (!decodedHeader?.kid) throw new Error("Invalid token: missing key id");

  const keys = await getSigningKeys();
  const key = keys.find((k) => k.kid === decodedHeader.kid);
  if (!key) throw new Error("Invalid token: unknown signing key");

  const pem = jwkToPem(key);
  const claims = jwt.verify(token, pem, {
    algorithms: ["RS256"],
    audience: env.entraAudience,
    issuer: `https://login.microsoftonline.com/${env.entraTenantId}/v2.0`,
  }) as EntraClaims;

  return claims;
}
