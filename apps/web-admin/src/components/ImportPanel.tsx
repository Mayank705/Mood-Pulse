import { useRef, useState } from "react";
import { API_BASE_URL, api, ApiClientError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { ImportSummary } from "../types";

interface Props {
  title: string;
  description: string;
  templatePath: string;
  templateFilename: string;
  importPath: string;
  onImported?: () => void;
}

export default function ImportPanel({ title, description, templatePath, templateFilename, importPath, onImported }: Props) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function downloadTemplate() {
    const res = await fetch(`${API_BASE_URL}${templatePath}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = templateFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<{ summary: ImportSummary }>(importPath, token, formData);
      setSummary(res.summary);
      onImported?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Import failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="text-xs text-slate-400 mt-1 mb-4">{description}</p>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={downloadTemplate} className="text-xs font-semibold text-brand-600 hover:underline">
          Download template (.xlsx)
        </button>
        <span className="text-slate-200">|</span>
        <label className="text-xs font-semibold text-brand-600 hover:underline cursor-pointer">
          {busy ? "Uploading…" : "Upload filled-in file"}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            disabled={busy}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </div>

      {error && <p className="text-sm text-rose-500 mt-3">{error}</p>}

      {summary && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-slate-600">
              <strong className="text-slate-800">{summary.totalRows}</strong> rows
            </span>
            <span className="text-emerald-600">
              <strong>{summary.created}</strong> created
            </span>
            <span className="text-amber-600">
              <strong>{summary.updated}</strong> updated
            </span>
            <span className="text-slate-500">
              <strong>{summary.skipped}</strong> unchanged
            </span>
            {summary.errors.length > 0 && (
              <span className="text-rose-600">
                <strong>{summary.errors.length}</strong> {summary.errors.length === 1 ? "row" : "rows"} skipped with errors
              </span>
            )}
          </div>
          {summary.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-rose-600 max-h-40 overflow-y-auto">
              {summary.errors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
