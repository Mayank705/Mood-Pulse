import { useState } from "react";
import { api, ApiClientError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { ImportSummary, SharePointFileRef } from "../types";

interface Props {
  syncPath: string;
  filePathHint: string;
  onSynced?: () => void;
}

const STORAGE_KEY_PREFIX = "daily-pulse:sharepoint-ref:";

export default function SharePointSyncPanel({ syncPath, filePathHint, onSynced }: Props) {
  const { token } = useAuth();
  const storageKey = STORAGE_KEY_PREFIX + syncPath;
  const [ref, setRef] = useState<SharePointFileRef>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "") as SharePointFileRef;
    } catch {
      return { siteHostname: "", sitePath: "", filePath: "" };
    }
  });
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setBusy(true);
    setError(null);
    setSummary(null);
    localStorage.setItem(storageKey, JSON.stringify(ref));
    try {
      const res = await api.post<{ summary: ImportSummary }>(syncPath, token, ref);
      setSummary(res.summary);
      onSynced?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const canSync = ref.siteHostname.trim() && ref.sitePath.trim() && ref.filePath.trim();

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
      <h3 className="text-sm font-semibold text-slate-700">Sync from SharePoint</h3>
      <p className="text-xs text-slate-400 mt-1 mb-4">
        Point this at a workbook in a SharePoint document library, formatted the same as the Excel template above.
        Requires a Microsoft Graph app registration configured by IT (see docs/DEPLOYMENT.md).
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Site hostname" placeholder="contoso.sharepoint.com" value={ref.siteHostname} onChange={(v) => setRef({ ...ref, siteHostname: v })} />
        <Field label="Site path" placeholder="/sites/HR" value={ref.sitePath} onChange={(v) => setRef({ ...ref, sitePath: v })} />
        <Field label="File path" placeholder={filePathHint} value={ref.filePath} onChange={(v) => setRef({ ...ref, filePath: v })} />
      </div>

      <button
        onClick={handleSync}
        disabled={!canSync || busy}
        className="mt-4 rounded-full bg-slate-800 text-white px-5 py-2 text-xs font-semibold hover:bg-slate-900 disabled:opacity-40 transition-colors"
      >
        {busy ? "Syncing…" : "Sync Now"}
      </button>

      {error && <p className="text-sm text-rose-500 mt-3">{error}</p>}

      {summary && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm flex flex-wrap gap-4">
          <span>
            <strong className="text-slate-800">{summary.totalRows}</strong> rows
          </span>
          <span className="text-emerald-600">
            <strong>{summary.created}</strong> created
          </span>
          <span className="text-amber-600">
            <strong>{summary.updated}</strong> updated
          </span>
          {summary.errors.length > 0 && (
            <span className="text-rose-600">
              <strong>{summary.errors.length}</strong> errors
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}
