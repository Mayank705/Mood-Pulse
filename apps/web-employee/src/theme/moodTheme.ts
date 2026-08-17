import { MoodLevel } from "../types";

export interface MoodTheme {
  /** Solid accent used for the glow, button, and focus ring. */
  accent: string;
  /** Two-stop ambient background gradient, light and airy. */
  ambientFrom: string;
  ambientTo: string;
  /** rgba() used for the selection glow / button shadow. */
  glow: string;
}

// A calm emotional spectrum rather than a literal "traffic light" — low
// moods get a quiet, heavier blue-violet instead of alarm red, so the
// screen never reads as scolding someone for how they feel.
export const MOOD_THEME: Record<MoodLevel, MoodTheme> = {
  VERY_HAPPY: { accent: "#eda23b", ambientFrom: "#fff3e0", ambientTo: "#fef9f0", glow: "rgba(237,162,59,0.35)" },
  GOOD: { accent: "#45b47d", ambientFrom: "#e8f7ef", ambientTo: "#f3fbf6", glow: "rgba(69,180,125,0.32)" },
  OKAY: { accent: "#6f7bdb", ambientFrom: "#eef0fd", ambientTo: "#f6f7fd", glow: "rgba(111,123,219,0.30)" },
  NOT_GREAT: { accent: "#d98a5c", ambientFrom: "#fbeee3", ambientTo: "#fcf6ef", glow: "rgba(217,138,92,0.30)" },
  VERY_LOW: { accent: "#7367c9", ambientFrom: "#efecfa", ambientTo: "#f4f2fb", glow: "rgba(115,103,201,0.32)" },
};

export const NEUTRAL_THEME: MoodTheme = {
  accent: "#6366f1",
  ambientFrom: "#eef2ff",
  ambientTo: "#f5f7ff",
  glow: "rgba(99,102,241,0.3)",
};

export function themeFor(mood: MoodLevel | null): MoodTheme {
  return mood ? MOOD_THEME[mood] : NEUTRAL_THEME;
}
