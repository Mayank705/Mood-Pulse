interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "neutral" | "low" | "attention";
}

const TONE_STYLES: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-slate-800",
  positive: "text-emerald-600",
  neutral: "text-amber-600",
  low: "text-rose-600",
  attention: "text-brand-600",
};

export default function SummaryCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${TONE_STYLES[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
