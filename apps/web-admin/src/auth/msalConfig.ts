import { Configuration } from "@azure/msal-browser";

/**
 * Real Microsoft Entra ID configuration for the admin portal, used when
 * VITE_AUTH_MODE=entra. Unlike the employee agent, this is a normal web app
 * sign-in (interactive login, not silent SSO) — HR/managers open it
 * deliberately rather than having it appear automatically at laptop login.
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? "",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID ?? "common"}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginScopes = [import.meta.env.VITE_ENTRA_API_SCOPE ?? "api://daily-pulse/.default"];
