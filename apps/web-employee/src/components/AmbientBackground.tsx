import { MoodTheme } from "../theme/moodTheme";

/**
 * A soft, slowly-drifting gradient backdrop whose color follows the
 * employee's current mood selection. Purely decorative — respects
 * prefers-reduced-motion via the `motion-reduce:animate-none` utility on
 * each blob.
 */
export default function AmbientBackground({ theme }: { theme: MoodTheme }) {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden transition-colors duration-700 ease-out"
      style={{ background: `linear-gradient(135deg, ${theme.ambientFrom}, ${theme.ambientTo})` }}
      aria-hidden="true"
    >
      <div
        className="absolute -top-24 -left-16 h-72 w-72 rounded-full blur-3xl opacity-60 animate-drift-slow motion-reduce:animate-none transition-colors duration-700 ease-out"
        style={{ background: theme.accent }}
      />
      <div
        className="absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full blur-3xl opacity-40 animate-drift-slower motion-reduce:animate-none transition-colors duration-700 ease-out"
        style={{ background: theme.accent }}
      />
      <div
        className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full blur-2xl opacity-30 animate-drift-slow motion-reduce:animate-none transition-colors duration-700 ease-out"
        style={{ background: theme.accent, animationDelay: "-4s" }}
      />
    </div>
  );
}
