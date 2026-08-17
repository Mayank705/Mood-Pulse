import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { DepartmentNode, OverviewResult } from "../types";

export default function Departments() {
  const { token } = useAuth();
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [stats, setStats] = useState<Record<string, OverviewResult>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ departments: DepartmentNode[] }>("/api/departments", token)
      .then(async (res) => {
        setDepartments(res.departments);
        const entries = await Promise.all(
          res.departments.map(async (d) => {
            const r = await api.get<{ overview: OverviewResult }>(`/api/departments/${d.id}/analytics`, token);
            return [d.id, r.overview] as const;
          })
        );
        setStats(Object.fromEntries(entries));
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">BUs</h1>
        <p className="text-sm text-slate-500">Response rate and mood distribution by BU.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {departments.map((dept) => {
          const s = stats[dept.id];
          const total = s ? s.positiveResponses + s.neutralResponses + s.lowResponses : 0;
          const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
          return (
            <Link
              key={dept.id}
              to={`/departments/${dept.id}`}
              className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-800">{dept.name}</h2>
                  <p className="text-xs text-slate-400">{dept.subDepartments.length} Competencies</p>
                </div>
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-2.5 py-1">
                  {s ? `${s.responseRate}% response rate` : "—"}
                </span>
              </div>
              {s && (
                <div className="space-y-2">
                  <Bar label="Positive" pct={pct(s.positiveResponses)} color="bg-emerald-400" />
                  <Bar label="Neutral" pct={pct(s.neutralResponses)} color="bg-amber-400" />
                  <Bar label="Low" pct={pct(s.lowResponses)} color="bg-rose-400" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
    </div>
  );
}
