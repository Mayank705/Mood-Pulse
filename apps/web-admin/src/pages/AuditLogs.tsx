import { useEffect, useState } from "react";
import { api, buildQuery } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { AuditLogEntry } from "../types";

const ACTIONS = ["", "LOGIN", "MOOD_SUBMIT", "VIEW_EMPLOYEE_DATA", "EXPORT", "PERMISSION_CHANGE", "HIERARCHY_CHANGE", "SETTINGS_CHANGE"];

export default function AuditLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const pageSize = 25;

  useEffect(() => {
    api
      .get<{ logs: AuditLogEntry[]; total: number }>(`/api/audit-logs${buildQuery({ page, pageSize, action: action || undefined })}`, token)
      .then((r) => {
        setLogs(r.logs);
        setTotal(r.total);
      });
  }, [token, page, action]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
          <p className="text-sm text-slate-500">{total} events recorded.</p>
        </div>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a || "All Actions"}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50">
              <th className="px-6 py-3 font-medium">When</th>
              <th className="px-6 py-3 font-medium">Actor</th>
              <th className="px-6 py-3 font-medium">Action</th>
              <th className="px-6 py-3 font-medium">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-6 py-3 text-slate-700">{log.actor ? `${log.actor.name} (${log.actor.employeeCode})` : "System"}</td>
                <td className="px-6 py-3">
                  <span className="text-xs font-medium bg-slate-100 text-slate-500 rounded-full px-2.5 py-1">{log.action}</span>
                </td>
                <td className="px-6 py-3 text-slate-500">{log.targetType ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-sm text-slate-400 py-10 text-center">No audit events for this filter.</p>}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="text-sm text-slate-500 disabled:text-slate-300"
        >
          Previous
        </button>
        <span className="text-xs text-slate-400">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="text-sm text-slate-500 disabled:text-slate-300"
        >
          Next
        </button>
      </div>
    </div>
  );
}
