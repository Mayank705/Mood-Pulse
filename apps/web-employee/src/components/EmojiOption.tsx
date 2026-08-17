import { MoodOption } from "../types";

interface Props {
  option: MoodOption;
  selected: boolean;
  onSelect: () => void;
}

export default function EmojiOption({ option, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={option.ariaLabel}
      className={`group relative flex flex-col items-center gap-2 rounded-3xl px-3 py-4 sm:px-4 sm:py-5 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${
        selected ? "bg-indigo-50 scale-110 animate-glow-pulse" : "bg-transparent hover:bg-slate-50 hover:scale-105"
      }`}
    >
      <span
        className={`text-4xl sm:text-5xl leading-none transition-transform duration-300 ${
          selected ? "scale-125" : "group-hover:animate-gentle-float"
        }`}
        role="img"
      >
        {option.emoji}
      </span>
      <span className={`text-[11px] sm:text-xs font-medium transition-colors ${selected ? "text-indigo-600" : "text-slate-400"}`}>
        {option.label}
      </span>
    </button>
  );
}
