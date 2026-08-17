import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { MOOD_EMOJI, MOOD_LABEL, OverviewResult, TeamMember } from "../types";
import SummaryCard from "../components/SummaryCard";
import { TrendDirectionBadge } from "../components/InsightBadge";

export default function Team() {
  const { user, token } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [overview, setOverview] = useState<OverviewResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get<{ team: TeamMember[] }>(`/api/managers/${user.id}/team`, token),
      api.get<{ overview: OverviewResult }>(`/api/managers/${user.id}/team-analytics`, token),
    ])
      .then(([t, o]) => {
        setTeam(t.team);
        setOverview(o.overview);
      })
      .finally(() => setLoading(false));
  }, [user, token]);

  if (loading) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Team</h1>
        <p className="text-sm text-slate-500">Mood trends for the people who report to you.</p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Team Size" value={String(overview.totalEmployees)} />
          <SummaryCard label="Response Rate" value={`${overview.responseRate}%`} />
          <SummaryCard label="Positive" value={String(overview.positiveResponses)} tone="positive" />
          <SummaryCard label="Requiring Attention" value={String(overview.employeesRequiringAttention)} tone="attention" />
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
              <th className="pb-3 font-medium">Employee</th>
              <th className="pb-3 font-medium">Current Mood</th>
              <th className="pb-3 font-medium">7-Day Trend</th>
              <th className="pb-3 font-medium">Trend</th>
              <th className="pb-3 font-medium">Responses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {team.map((member) => (
              <tr key={member.employee.id} className="hover:bg-slate-50">
                <td className="py-3">
                  <Link to={`/employees/${member.employee.id}`} className="text-slate-700 font-medium hover:text-brand-600">
                    {member.employee.name}
                  </Link>
                  <p className="text-xs text-slate-400">{member.employee.jobTitle}</p>
                </td>
                <td className="py-3 text-2xl">{member.currentMood ? MOOD_EMOJI[member.currentMood] : "—"}</td>
                <td className="py-3">
                  <span className="flex gap-1 text-lg">
                    {member.sevenDayTrend.map((p, i) => (
                      <span key={i} title={MOOD_LABEL[p.mood]}>
                        {MOOD_EMOJI[p.mood]}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="py-3">
                  <TrendDirectionBadge direction={member.trendDirection} />
                </td>
                <td className="py-3 text-slate-500">{member.responseCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {team.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">No direct reports found.</p>}
      </div>
    </div>
  );
}
