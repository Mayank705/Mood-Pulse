import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { EmployeeSummary, EmployeeTrend, MOOD_EMOJI, MOOD_LABEL, MoodHistoryEntry } from "../types";
import InsightBadge, { TrendDirectionBadge } from "../components/InsightBadge";
import EmojiStrip from "../components/EmojiStrip";

type RangeKey = "7" | "30" | "90";

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, can } = useAuth();
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [trend, setTrend] = useState<EmployeeTrend | null>(null);
  const [history, setHistory] = useState<MoodHistoryEntry[]>([]);
  const [range, setRange] = useState<RangeKey>("30");
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<{ employee: EmployeeSummary }>(`/api/employees/${id}`, token)
      .then((r) => setEmployee(r.employee))
      .catch((err) => setAccessError(err instanceof Error ? err.message : "Couldn't load this employee"));
  }, [id, token]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ trend: EmployeeTrend; history: MoodHistoryEntry[] }>(`/api/employees/${id}/mood-history?days=${range}`, token)
      .then((r) => {
        setTrend(r.trend);
        setHistory(r.history);
      })
      .catch((err) => setAccessError(err instanceof Error ? err.message : "Couldn't load this employee"))
      .finally(() => setLoading(false));
  }, [id, range, token]);

  if (accessError) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-10 text-center">
        <p className="text-3xl mb-2">🔒</p>
        <p className="text-slate-500 text-sm">{accessError}</p>
      </div>
    );
  }

  if (!employee) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Loading…</div>;

  const canSeeComments = can("employee:view_comments");

  return (
    <div className="space-y-6">
      <Link to="/employees" className="text-xs text-brand-600 hover:underline">
        ← Employee Directory
      </Link>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{employee.name}</h1>
          <p className="text-sm text-slate-500">{employee.jobTitle}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
          <Field label="BU" value={employee.department.name} />
          <Field label="Competency" value={employee.subDepartment.name} />
          <Field label="SuperCoach" value={employee.manager?.name ?? "—"} />
          <Field label="Co-SuperCoach" value={employee.manager?.manager?.name ?? "—"} />
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Mood Trend</h2>
          <div className="flex gap-1">
            {(["7", "30", "90"] as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                  range === r ? "bg-brand-600 text-white border-brand-600" : "border-slate-200 text-slate-500 hover:border-brand-300"
                }`}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {trend && <TrendDirectionBadge direction={trend.direction} />}
              {trend?.insights.map((i) => (
                <InsightBadge key={i.code} insight={i} />
              ))}
              {trend && trend.insights.length === 0 && <span className="text-xs text-slate-400">No notable patterns detected.</span>}
            </div>
            <p className="text-xs text-slate-400 mb-3">These are data patterns only, not conclusions about the employee's wellbeing.</p>
            <div className="overflow-x-auto pb-2">
              <EmojiStrip points={history} />
            </div>
          </>
        )}
      </div>

      {canSeeComments && (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Comments</h2>
          <div className="space-y-3">
            {history
              .filter((h) => h.comment)
              .slice()
              .reverse()
              .map((h, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-xl">{MOOD_EMOJI[h.mood]}</span>
                  <div>
                    <p className="text-slate-600">{h.comment}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(h.responseDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {MOOD_LABEL[h.mood]}
                    </p>
                  </div>
                </div>
              ))}
            {history.filter((h) => h.comment).length === 0 && <p className="text-sm text-slate-400">No comments in this period.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-slate-700 font-medium">{value}</p>
    </div>
  );
}
