import { MOOD_EMOJI, MOOD_LABEL, MoodLevel } from "../types";

interface Point {
  date?: string;
  responseDate?: string;
  mood: MoodLevel;
}

export default function EmojiStrip({ points }: { points: Point[] }) {
  if (points.length === 0) return <p className="text-sm text-slate-400">No responses in this period.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {points.map((p, i) => {
        const date = p.date ?? p.responseDate ?? String(i);
        return (
          <div key={date + i} className="flex flex-col items-center gap-1" title={`${date}: ${MOOD_LABEL[p.mood]}`}>
            <span className="text-2xl" role="img" aria-label={MOOD_LABEL[p.mood]}>
              {MOOD_EMOJI[p.mood]}
            </span>
            <span className="text-[10px] text-slate-400">{formatShortDate(date)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
