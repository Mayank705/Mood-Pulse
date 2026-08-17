import { useState } from "react";
import { API_BASE_URL, buildQuery } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import HierarchyFilter from "../components/HierarchyFilter";
import { HierarchyFilterValue } from "../types";

type Format = "csv" | "xlsx" | "pdf";

export default function Reports() {
  const { token, can } = useAuth();
  const [filter, setFilter] = useState<HierarchyFilterValue>({});
  const [format, setFormat] = useState<Format>("csv");
  const [days, setDays] = useState(30);
  const [includeComments, setIncludeComments] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const query = buildQuery({
        format,
        days,
        includeComments,
        departmentId: filter.departmentId,
        subDepartmentId: filter.subDepartmentId,
        managerId: filter.managerId,
      });
      const res = await fetch(`${API_BASE_URL}/api/reports/mood${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Report generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mood-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <p className="text-sm text-slate-500">Export mood data for the selected scope, respecting your role's data access.</p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6 space-y-5">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Scope</p>
          <HierarchyFilter value={filter} onChange={setFilter} />
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Period (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF</option>
            </select>
          </label>

          {can("employee:view_comments") && (
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" checked={includeComments} onChange={(e) => setIncludeComments(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-600">Include comments</span>
            </label>
          )}
        </div>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-full bg-brand-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {downloading ? "Preparing…" : "Download Report"}
        </button>
      </div>
    </div>
  );
}
