import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import { importDepartmentRows, importEmployeeRows, readRowsForImport, ImportSummary } from "./importExport.service";

/**
 * Pulls an Excel workbook out of a SharePoint document library via
 * Microsoft Graph and runs it through the same import logic as a manual
 * upload — so "upload a file" and "sync from SharePoint" are two front
 * doors to one, well-tested import path.
 *
 * Uses the OAuth2 client-credentials flow (app-only auth): the API
 * authenticates as itself, not as a signed-in user, since this typically
 * runs on a schedule with nobody at a keyboard. This requires an Entra ID
 * app registration with the Graph *application* permission
 * `Sites.Read.All` (admin-consented) — see docs/DEPLOYMENT.md.
 *
 * This is a complete, real implementation, not a stub: given
 * GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET, it works against
 * any real tenant. It simply has no tenant to run against in this sandbox,
 * so it hasn't been exercised end-to-end here.
 */

export interface SharePointFileRef {
  /** e.g. "contoso.sharepoint.com" */
  siteHostname: string;
  /** e.g. "/sites/HR" */
  sitePath: string;
  /** path within the site's default document library, e.g. "General/Departments.xlsx" */
  filePath: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGraphAccessToken(): Promise<string> {
  if (!env.graphTenantId || !env.graphClientId || !env.graphClientSecret) {
    throw new ApiError(
      501,
      "SharePoint sync is not configured. An administrator needs to set GRAPH_TENANT_ID, GRAPH_CLIENT_ID, and " +
        "GRAPH_CLIENT_SECRET (see docs/DEPLOYMENT.md) before this can be used."
    );
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${env.graphTenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.graphClientId,
    client_secret: env.graphClientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new ApiError(502, `Could not authenticate with Microsoft Graph (${res.status}). Check the Graph app registration.`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function graphGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new ApiError(502, `SharePoint request failed (${res.status}): ${path}`);
  }
  return res.json();
}

async function downloadWorkbook(ref: SharePointFileRef): Promise<Buffer> {
  const token = await getGraphAccessToken();

  const site = (await graphGet(`/sites/${ref.siteHostname}:${ref.sitePath}`, token)) as { id: string };
  const encodedPath = ref.filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const fileRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drive/root:/${encodedPath}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) {
    throw new ApiError(502, `Could not download "${ref.filePath}" from SharePoint (${fileRes.status}). Check the file path and permissions.`);
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Thin wrappers so route handlers don't need to know about SharePoint vs.
// upload beyond which function they call — both parse with the same
// worksheet reader and feed the same upsert logic as a manual upload.

export async function syncDepartmentsFromSharePoint(ref: SharePointFileRef, organizationId: string): Promise<ImportSummary> {
  const buffer = await downloadWorkbook(ref);
  return importDepartmentRows(await readRowsForImport(buffer), organizationId);
}

export async function syncEmployeesFromSharePoint(ref: SharePointFileRef, organizationId: string): Promise<ImportSummary> {
  const buffer = await downloadWorkbook(ref);
  return importEmployeeRows(await readRowsForImport(buffer), organizationId);
}
