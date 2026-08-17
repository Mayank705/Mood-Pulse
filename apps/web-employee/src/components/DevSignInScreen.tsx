import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

interface DirectoryEntry {
  email: string;
  name: string;
  role: string;
  jobTitle: string;
}

/**
 * Dev-only stand-in for corporate SSO. In production (VITE_AUTH_MODE=entra)
 * this screen never renders — the employee's Entra ID session on their
 * managed laptop signs them in silently, with no screen shown at all.
 */
export default function DevSignInScreen() {
  const { signInDev, error } = useAuth();
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/dev-directory`)
      .then((r) => r.json())
      .then((body) => setDirectory(body.employees ?? []))
      .catch(() => setDirectory([]));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white/90 shadow-xl shadow-indigo-100 border border-indigo-50 p-8">
        <p className="text-xs font-semibold tracking-wide text-indigo-400 uppercase mb-1">Development sign-in</p>
        <h1 className="text-xl font-bold text-slate-800 mb-4">Choose an account</h1>
        <p className="text-sm text-slate-500 mb-4">
          Stands in for corporate Microsoft Entra ID sign-in during local development. In production this screen is
          replaced by silent single sign-on.
        </p>
        {error && <p className="text-sm text-rose-500 mb-3">{error}</p>}
        <div className="max-h-72 overflow-y-auto space-y-1 -mx-2 px-2">
          {directory.map((entry) => (
            <button
              key={entry.email}
              onClick={() => signInDev(entry.email)}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-between group"
            >
              <span>
                <span className="block text-sm font-medium text-slate-700">{entry.name}</span>
                <span className="block text-xs text-slate-400">{entry.jobTitle}</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Sign in
              </span>
            </button>
          ))}
          {directory.length === 0 && <p className="text-sm text-slate-400 px-3 py-6 text-center">Loading directory…</p>}
        </div>
      </div>
    </div>
  );
}
