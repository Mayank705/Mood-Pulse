import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api/client";
import { authMode, useAuth } from "../auth/AuthProvider";

interface DirectoryEntry {
  email: string;
  name: string;
  role: string;
  jobTitle: string;
}

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager",
  HR_ADMIN: "HR / Admin",
  SUPER_ADMIN: "Super Admin",
};

export default function Login() {
  const { signInDev, signInEntra, error, status } = useAuth();
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/dev-directory`)
      .then((r) => r.json())
      .then((body) => setDirectory((body.employees ?? []).filter((e: DirectoryEntry) => e.role !== "EMPLOYEE")))
      .catch(() => setDirectory([]));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">DP</div>
          <span className="font-semibold text-slate-800">Daily Pulse</span>
        </div>
        <h1 className="text-lg font-bold text-slate-800 mt-4 mb-1">Admin & Manager Portal</h1>
        <p className="text-sm text-slate-500 mb-6">Sign in to view organizational mood insights.</p>

        {status === "forbidden" && (
          <p className="text-sm bg-rose-50 text-rose-600 rounded-lg px-3 py-2 mb-4">
            This account doesn't have access to the admin portal.
          </p>
        )}
        {error && <p className="text-sm bg-rose-50 text-rose-600 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {authMode === "entra" ? (
          <button
            onClick={() => signInEntra()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Sign in with Microsoft
          </button>
        ) : (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Development sign-in</p>
            <div className="max-h-80 overflow-y-auto space-y-1 -mx-2 px-2 border border-slate-100 rounded-xl py-1">
              {directory.map((entry) => (
                <button
                  key={entry.email}
                  onClick={() => signInDev(entry.email)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-brand-50 transition-colors flex items-center justify-between group"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-700">{entry.name}</span>
                    <span className="block text-xs text-slate-400">{entry.jobTitle}</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2 py-1 group-hover:bg-brand-100 group-hover:text-brand-600">
                    {ROLE_LABEL[entry.role] ?? entry.role}
                  </span>
                </button>
              ))}
              {directory.length === 0 && <p className="text-sm text-slate-400 px-3 py-6 text-center">Loading directory…</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
