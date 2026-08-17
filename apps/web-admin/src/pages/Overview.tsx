import { useEffect, useState } from "react";
import { api, buildQuery } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import SummaryCard from "../components/SummaryCard";
import MoodTrendChart from "../components/MoodTrendChart";
import HierarchyFilter from "../components/HierarchyFilter";
import { FlaggedEmployee, HierarchyFilterValue, OverviewResult } from "../types";
import { Link } from "react-router-dom";

type RangeKey = "today" | "7d" | "30d" | "90d";

const RANGE_DAYS: Record<RangeKey, number | null> = { today: 0, "7d": 7, "30d": 30, "90d": 90 };

export default function Overview() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<HierarchyFilterValue>({});
  const [range, setRange] = useState<RangeKey>("30d");
  const [overview, setOverview] = useState<OverviewResult | null>(null);
  const [flagged, setFlagged] = useState<FlaggedEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const days = RANGE_DAYS[range];
    const from = days ? new Date(Date.now() - days * 86400000).toISOString() : undefined;
    const query = buildQuery({
      departmentId: filter.departmentId,
      subDepartmentId: filter.subDepartmentId,
      managerId: filter.managerId,
      from,
    });

    Promise.all([
      api.get<{ overview: OverviewResult }>(`/api/dashboard/overview${query}`, token),
      api.get<{ flagged: FlaggedEmployee[] }>(`/api/dashboard/flagged-employees${query}`, token),
    ])
      .then(([o, f]) => {
        setOverview(o.overview);
        setFlagged(f.flagged);
      })
      .finally(() => setLoading(false));
  }, [token, filter, range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Organization Pulse</h1>
          <p className="text-sm text-slate-500">A snapshot of how the organization is feeling, and where a conversation might help.</p>
        </div>
        <div className="flex items-end gap-3">
          <HierarchyFilter value={filter} onChange={setFilter} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-400">Range</span>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 3 Months</option>
            </select>
          </label>
        </div>
      </div>

      {loading || !overview ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total Employees" value={String(overview.totalEmployees)} />
            <SummaryCard label="Responses Today" value={String(overview.responsesToday)} />
            <SummaryCard label="Response Rate" value={`${overview.responseRate}%`} />
            <SummaryCard
              label="Employees Requiring Attention"
              value={String(overview.employeesRequiringAttention)}
              tone="attention"
              hint="Based on repeated low or sudden-change patterns"
            />
            <SummaryCard label="Positive Responses" value={String(overview.positiveResponses)} tone="positive" />
            <SummaryCard label="Neutral Responses" value={String(overview.neutralResponses)} tone="neutral" />
            <SummaryCard label="Low Responses" value={String(overview.lowResponses)} tone="low" />
            <SummaryCard label="Average Mood Score" value={overview.averageMoodValue?.toFixed(2) ?? "—"} hint="Internal analytics score, 1–5" />
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Daily Mood Trend</h2>
            <MoodTrendChart data={overview.dailyTrend} />
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Employees Flagged for Review</h2>
            <p className="text-xs text-slate-400 mb-4">Data patterns only — not a diagnosis. Use judgment before reaching out.</p>
            {flagged.length === 0 ? (
              <p className="text-sm text-slate-400">No flagged patterns in this selection right now.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {flagged.slice(0, 10).map((f) => (
                  <Link
                    key={f.employee.id}
                    to={`/employees/${f.employee.id}`}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">{f.employee.name}</p>
                      <p className="text-xs text-slate-400">
                        {f.employee.department.name} · {f.employee.jobTitle}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {f.trend.insights.map((i) => (
                        <span key={i.code} className="text-xs bg-rose-50 text-rose-600 rounded-full px-2.5 py-1">
                          {i.message}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
