import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, buildQuery } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import HierarchyFilter from "../components/HierarchyFilter";
import InsightBadge from "../components/InsightBadge";
import { FlaggedEmployee, HierarchyFilterValue } from "../types";

export default function Trends() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<HierarchyFilterValue>({});
  const [flagged, setFlagged] = useState<FlaggedEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const query = buildQuery({ departmentId: filter.departmentId, subDepartmentId: filter.subDepartmentId, managerId: filter.managerId });
    api
      .get<{ flagged: FlaggedEmployee[] }>(`/api/dashboard/flagged-employees${query}`, token)
      .then((r) => setFlagged(r.flagged))
      .finally(() => setLoading(false));
  }, [token, filter]);

  const counts = {
    REPEATED_LOW: flagged.filter((f) => f.trend.insights.some((i) => i.code === "REPEATED_LOW")).length,
    DECLINING_TREND: flagged.filter((f) => f.trend.insights.some((i) => i.code === "DECLINING_TREND")).length,
    SUDDEN_CHANGE: flagged.filter((f) => f.trend.insights.some((i) => i.code === "SUDDEN_CHANGE")).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trends & Insights</h1>
          <p className="text-sm text-slate-500">Sustained mood patterns worth a human conversation — not a diagnosis.</p>
        </div>
        <HierarchyFilter value={filter} onChange={setFilter} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Repeated Low Responses" value={counts.REPEATED_LOW} />
        <StatTile label="Declining Trend" value={counts.DECLINING_TREND} />
        <StatTile label="Sudden Change" value={counts.SUDDEN_CHANGE} />
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : flagged.length === 0 ? (
          <p className="text-sm text-slate-400">No flagged patterns for this selection.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {flagged.map((f) => (
              <Link
                key={f.employee.id}
                to={`/employees/${f.employee.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">{f.employee.name}</p>
                  <p className="text-xs text-slate-400">
                    {f.employee.department.name} · {f.employee.manager?.name ?? "No manager on file"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {f.trend.insights.map((i) => (
                    <InsightBadge key={i.code} insight={i} />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
