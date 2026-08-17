import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { DepartmentNode, OverviewResult, TeamMember } from "../types";
import MoodTrendChart from "../components/MoodTrendChart";
import { MOOD_EMOJI, MOOD_LABEL } from "../types";
import { TrendDirectionBadge } from "../components/InsightBadge";

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [department, setDepartment] = useState<DepartmentNode | null>(null);
  const [overview, setOverview] = useState<OverviewResult | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [subOverview, setSubOverview] = useState<OverviewResult | null>(null);
  const [activeManager, setActiveManager] = useState<{ id: string; name: string } | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (!id) return;
    api.get<{ departments: DepartmentNode[] }>("/api/departments", token).then((res) => {
      setDepartment(res.departments.find((d) => d.id === id) ?? null);
    });
    api.get<{ overview: OverviewResult }>(`/api/departments/${id}/analytics`, token).then((r) => setOverview(r.overview));
  }, [id, token]);

  useEffect(() => {
    if (!id || !activeSub) {
      setSubOverview(null);
      return;
    }
    api.get<{ overview: OverviewResult }>(`/api/departments/${id}/sub-departments/${activeSub}/analytics`, token).then((r) => setSubOverview(r.overview));
  }, [id, activeSub, token]);

  useEffect(() => {
    if (!activeManager) {
      setTeam([]);
      return;
    }
    api.get<{ team: TeamMember[] }>(`/api/managers/${activeManager.id}/team`, token).then((r) => setTeam(r.team));
  }, [activeManager, token]);

  if (!department || !overview) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/departments" className="text-xs text-brand-600 hover:underline">
          ← All BUs
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-1">{department.name}</h1>
        <p className="text-sm text-slate-500">
          Response Rate: <strong className="text-slate-700">{overview.responseRate}%</strong> · Overall Trend:{" "}
          <TrendDirectionBadge direction={trendFromAvg(overview.dailyTrend)} />
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
        <MoodTrendChart data={overview.dailyTrend} />
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Competencies</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {department.subDepartments.map((sub) => (
            <button
              key={sub.id}
              onClick={() => {
                setActiveSub(sub.id === activeSub ? null : sub.id);
                setActiveManager(null);
              }}
              className={`text-sm rounded-full px-4 py-2 border transition-colors ${
                activeSub === sub.id ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-600 hover:border-brand-300"
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>

        {activeSub && subOverview && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniStat label="Response Rate" value={`${subOverview.responseRate}%`} />
            <MiniStat label="Avg. Score" value={subOverview.averageMoodValue?.toFixed(2) ?? "—"} />
            <MiniStat label="Attention" value={String(subOverview.employeesRequiringAttention)} />
          </div>
        )}

        {activeSub && (
          <div className="flex flex-wrap gap-2">
            {department.subDepartments
              .find((s) => s.id === activeSub)
              ?.employees.map((manager) => (
                <button
                  key={manager.id}
                  onClick={() => setActiveManager(manager.id === activeManager?.id ? null : { id: manager.id, name: manager.name })}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                    activeManager?.id === manager.id ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:border-slate-400"
                  }`}
                >
                  {manager.name}
                </button>
              ))}
            {department.subDepartments.find((s) => s.id === activeSub)?.employees.length === 0 && (
              <p className="text-xs text-slate-400">No SuperCoaches found in this Competency.</p>
            )}
          </div>
        )}
      </div>

      {activeManager && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">{activeManager.name} — Team Mood</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="pb-2 font-medium">Employee</th>
                <th className="pb-2 font-medium">Current Mood</th>
                <th className="pb-2 font-medium">7-Day Trend</th>
                <th className="pb-2 font-medium">Responses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {team.map((member) => (
                <tr key={member.employee.id} className="hover:bg-slate-50">
                  <td className="py-2.5">
                    <Link to={`/employees/${member.employee.id}`} className="text-slate-700 font-medium hover:text-brand-600">
                      {member.employee.name}
                    </Link>
                    <p className="text-xs text-slate-400">{member.employee.jobTitle}</p>
                  </td>
                  <td className="py-2.5 text-xl">{member.currentMood ? MOOD_EMOJI[member.currentMood] : "—"}</td>
                  <td className="py-2.5">
                    <span className="flex gap-1 text-lg">
                      {member.sevenDayTrend.map((p, i) => (
                        <span key={i} title={MOOD_LABEL[p.mood]}>
                          {MOOD_EMOJI[p.mood]}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-500">{member.responseCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-slate-700">{value}</p>
    </div>
  );
}

function trendFromAvg(daily: OverviewResult["dailyTrend"]): string {
  if (daily.length < 4) return "insufficient_data";
  const mid = Math.floor(daily.length / 2);
  const avg = (arr: OverviewResult["dailyTrend"]) => {
    const vals = arr.map((d) => d.averageMoodValue).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const early = avg(daily.slice(0, mid));
  const late = avg(daily.slice(mid));
  if (early === null || late === null) return "insufficient_data";
  if (late - early >= 0.4) return "improving";
  if (late - early <= -0.4) return "declining";
  return "stable";
}
