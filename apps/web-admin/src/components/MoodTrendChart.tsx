import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  date: string;
  averageMoodValue: number | null;
  responseCount: number;
}

// Numeric internal mood scores are shown here deliberately — this chart is
// admin-only. The employee-facing app never renders numbers.
export default function MoodTrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-slate-400">No data for this period yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          labelFormatter={(d) => new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          formatter={(value: number, name) => [value?.toFixed?.(2) ?? value, name === "averageMoodValue" ? "Avg. mood score" : name]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Line type="monotone" dataKey="averageMoodValue" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
