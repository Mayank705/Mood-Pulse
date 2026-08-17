import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginScopes } from "./msalConfig";
import { api, API_BASE_URL } from "../api/client";
import { AuthUser } from "../types";

const PERMISSION_KEYS = [
  "mood:submit_own",
  "team:view",
  "analytics:view_org",
  "analytics:view_department",
  "employee:view_directory",
  "employee:view_comments",
  "hierarchy:manage",
  "settings:manage",
  "users:manage",
  "audit:view",
  "reports:export",
] as const;
export type Permission = (typeof PERMISSION_KEYS)[number];

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  permissions: Permission[];
  status: "loading" | "signed-out" | "signed-in" | "forbidden" | "error";
  error: string | null;
  signInDev: (email: string) => Promise<void>;
  signInEntra: () => Promise<void>;
  signOut: () => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? "dev";
const TOKEN_STORAGE_KEY = "daily-pulse:admin-token";

let msalInstance: PublicClientApplication | null = null;
if (AUTH_MODE === "entra") {
  msalInstance = new PublicClientApplication(msalConfig);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (nextToken: string) => {
    const res = await api.get<{ user: AuthUser; permissions: Permission[] }>("/api/auth/me", nextToken);
    // This is defense-in-depth only: the API enforces every permission
    // server-side regardless. Blocking here is purely so a plain EMPLOYEE
    // account never even sees admin UI chrome flash on screen.
    if (res.user.role === "EMPLOYEE") {
      setStatus("forbidden");
      return;
    }
    setUser(res.user);
    setPermissions(res.permissions);
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

  const signOut = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setStatus("signed-out");
    if (msalInstance) msalInstance.clearCache();
  }, []);

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

      if (!msalInstance) return;
      try {
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise();
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length === 0) {
          if (!cancelled) setStatus("signed-out");
          return;
        }
        const result = await msalInstance.acquireTokenSilent({ scopes: loginScopes, account: accounts[0] });
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

  const signInEntra = useCallback(async () => {
    if (!msalInstance) return;
    setStatus("loading");
    try {
      const result = await msalInstance.loginPopup({ scopes: loginScopes });
      await loadProfile(result.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setStatus("error");
    }
  }, [loadProfile]);

  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, permissions, status, error, signInDev, signInEntra, signOut, can }),
    [user, token, permissions, status, error, signInDev, signInEntra, signOut, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const authMode = AUTH_MODE;
