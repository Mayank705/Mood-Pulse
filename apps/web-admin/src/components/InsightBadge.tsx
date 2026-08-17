import { TrendInsight } from "../types";

const STYLE: Record<TrendInsight["code"], string> = {
  REPEATED_LOW: "bg-rose-50 text-rose-600 border-rose-100",
  DECLINING_TREND: "bg-amber-50 text-amber-700 border-amber-100",
  SUDDEN_CHANGE: "bg-violet-50 text-violet-600 border-violet-100",
};

export default function InsightBadge({ insight }: { insight: TrendInsight }) {
  return (
    <span className={`inline-block text-xs font-medium border rounded-full px-2.5 py-1 ${STYLE[insight.code]}`}>{insight.message}</span>
  );
}

export function TrendDirectionBadge({ direction }: { direction: string }) {
  const style: Record<string, string> = {
    improving: "bg-emerald-50 text-emerald-600",
    stable: "bg-slate-100 text-slate-500",
    declining: "bg-amber-50 text-amber-700",
    insufficient_data: "bg-slate-50 text-slate-400",
  };
  const label: Record<string, string> = {
    improving: "Improving",
    stable: "Stable",
    declining: "Declining",
    insufficient_data: "Not enough data",
  };
  return <span className={`inline-block text-xs font-semibold rounded-full px-2.5 py-1 ${style[direction] ?? style.stable}`}>{label[direction] ?? direction}</span>;
}
