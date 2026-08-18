export type MoodLevel = "VERY_HAPPY" | "GOOD" | "OKAY" | "NOT_GREAT" | "VERY_LOW";

export interface MoodOption {
  mood: MoodLevel;
  emoji: string;
  label: string;
  // Accessible description — screen readers announce this even though no
  // numbers are ever shown or spoken as a "rating".
  ariaLabel: string;
}

// Left to right: Very Low -> Very Happy, so the most positive option sits
// on the right. Numbers are intentionally never part of this UI.
export const MOOD_OPTIONS: MoodOption[] = [
  { mood: "VERY_LOW", emoji: "😢", label: "Very Low", ariaLabel: "Very Low" },
  { mood: "NOT_GREAT", emoji: "😟", label: "Not Great", ariaLabel: "Not Great" },
  { mood: "OKAY", emoji: "😐", label: "Okay", ariaLabel: "Okay" },
  { mood: "GOOD", emoji: "🙂", label: "Good", ariaLabel: "Good" },
  { mood: "VERY_HAPPY", emoji: "😄", label: "Very Happy", ariaLabel: "Very Happy" },
];

export interface TodayStatus {
  alreadySubmitted: boolean;
  submittedAt: string | null;
  withinWindow: boolean;
  allowLateCheckins: boolean;
  shouldPrompt: boolean;
  promptDelaySeconds: number;
  checkinStartTime: string;
  checkinEndTime: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}
