import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginScopes } from "./msalConfig";
import { api, API_BASE_URL } from "../api/client";
import { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  status: "loading" | "signed-out" | "signed-in" | "error";
  error: string | null;
  signInDev: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? "dev";
const TOKEN_STORAGE_KEY = "daily-pulse:employee-token";

let msalInstance: PublicClientApplication | null = null;
if (AUTH_MODE === "entra") {
  msalInstance = new PublicClientApplication(msalConfig);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (nextToken: string) => {
    const res = await api.get<{ user: AuthUser }>("/api/auth/me", nextToken);
    setUser(res.user);
    setToken(nextToken);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    setStatus("signed-in");
  }, []);

  const signInDev = useCallback(
    async (email: string) => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? "Sign-in failed");
        }
        const body = await res.json();
        await loadProfile(body.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed");
        setStatus("error");
      }
    },
    [loadProfile]
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      if (AUTH_MODE === "dev") {
        if (token) {
          try {
            await loadProfile(token);
          } catch {
            sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            if (!cancelled) setStatus("signed-out");
          }
        } else if (!cancelled) {
          setStatus("signed-out");
        }
        return;
      }

      // Entra ID: silent SSO first (works transparently on a corporate,
      // Entra-joined device — this is the real "open laptop, no login
      // screen" production path), falling back to an interactive popup
      // only if silent SSO can't resolve an account.
      if (!msalInstance) return;
      try {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise();
        const accounts = msalInstance.getAllAccounts();
        const account =
          accounts[0] ??
          (await msalInstance
            .ssoSilent({ scopes: loginScopes })
            .then((r) => r.account)
            .catch(() => null));

        if (!account) {
          const result = await msalInstance.loginPopup({ scopes: loginScopes });
          if (cancelled) return;
          await loadProfile(result.accessToken);
          return;
        }

        const result = await msalInstance.acquireTokenSilent({ scopes: loginScopes, account });
        if (cancelled) return;
        await loadProfile(result.accessToken);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Authentication failed");
          setStatus("error");
        }
      }
    }

    initialize();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, status, error, signInDev }),
    [user, token, status, error, signInDev]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const authMode = AUTH_MODE;
