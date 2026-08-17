import { Configuration } from "@azure/msal-browser";

/**
 * Real Microsoft Entra ID configuration, used when VITE_AUTH_MODE=entra.
 * The employee never sees a login screen in production: with the corporate
 * device already joined to Entra ID, `ssoSilent` resolves without any UI,
 * consistent with the "open laptop -> answer one question" principle.
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID ?? "",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID ?? "common"}`,
    redirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    // sessionStorage, not localStorage: the check-in window is a short-lived
    // task, and we don't want a stale token surviving across days on a
    // shared/kiosk-style device.
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginScopes = [import.meta.env.VITE_ENTRA_API_SCOPE ?? "api://daily-pulse/.default"];
