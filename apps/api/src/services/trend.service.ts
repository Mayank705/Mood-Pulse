/**
 * Pure trend-detection logic — no DB access, so it's easy to unit test.
 *
 * Deliberately conservative in language: every output is a description of a
 * data pattern ("repeated low responses detected", "mood trend has declined
 * recently"), never a conclusion about the person ("this employee is
 * unhappy/stressed/depressed"). See spec §17/§49.
 */

export interface MoodPoint {
  responseDate: string; // ISO date
  moodValue: number; // 1-5
}

export type TrendDirection = "improving" | "stable" | "declining" | "insufficient_data";

export interface TrendInsight {
  code: "REPEATED_LOW" | "DECLINING_TREND" | "SUDDEN_CHANGE";
  message: string;
}

export interface EmployeeTrendResult {
  direction: TrendDirection;
  averageMoodValue: number | null;
  responseCount: number;
  insights: TrendInsight[];
}

export function categorize(moodValue: number): "positive" | "neutral" | "low" {
  if (moodValue >= 4) return "positive";
  if (moodValue === 3) return "neutral";
  return "low";
}

function average(points: MoodPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + p.moodValue, 0) / points.length;
}

export interface TrendConfig {
  lowMoodThresholdCount: number;
  lowMoodWindowDays: number;
  decliningWindowDays: number;
}

/**
 * `points` must be sorted ascending by responseDate and already scoped to
 * the employee and the widest window the caller wants inspected
 * (decliningWindowDays is typically the largest window in play).
 */
export function detectEmployeeTrend(points: MoodPoint[], config: TrendConfig): EmployeeTrendResult {
  const insights: TrendInsight[] = [];

  if (points.length === 0) {
    return { direction: "insufficient_data", averageMoodValue: null, responseCount: 0, insights };
  }

  const overallAvg = average(points)!;

  // --- Repeated low responses: N+ low-mood entries within the low-mood window
  const lowWindowStart = points.length - config.lowMoodWindowDays;
  const recentWindow = points.slice(Math.max(0, lowWindowStart));
  const lowCount = recentWindow.filter((p) => p.moodValue <= 2).length;
  if (lowCount >= config.lowMoodThresholdCount) {
    insights.push({
      code: "REPEATED_LOW",
      message: `Repeated low mood responses detected (${lowCount} in the last ${recentWindow.length} check-ins).`,
    });
  }

  // --- Declining trend: split the declining window in half, compare averages
  const decliningSlice = points.slice(Math.max(0, points.length - config.decliningWindowDays));
  let direction: TrendDirection = "stable";
  if (decliningSlice.length >= 6) {
    const mid = Math.floor(decliningSlice.length / 2);
    const earlier = average(decliningSlice.slice(0, mid))!;
    const later = average(decliningSlice.slice(mid))!;
    const delta = later - earlier;
    if (delta <= -0.6) {
      direction = "declining";
      insights.push({ code: "DECLINING_TREND", message: "Mood trend has declined recently." });
    } else if (delta >= 0.6) {
      direction = "improving";
    }
  } else {
    direction = "insufficient_data";
  }

  // --- Sudden change: last 3 responses are all low, but the baseline before
  // them was clearly not (avoids double-firing this on someone who is
  // simply consistently low, which REPEATED_LOW already covers).
  if (points.length >= 6) {
    const lastThree = points.slice(-3);
    const priorBaseline = points.slice(0, -3);
    const lastThreeAvg = average(lastThree)!;
    const baselineAvg = average(priorBaseline)!;
    const allRecentLow = lastThree.every((p) => p.moodValue <= 2);
    if (allRecentLow && baselineAvg - lastThreeAvg >= 1.25) {
      insights.push({ code: "SUDDEN_CHANGE", message: "Recent change in mood pattern detected." });
    }
  }

  return {
    direction,
    averageMoodValue: Math.round(overallAvg * 100) / 100,
    responseCount: points.length,
    insights,
  };
}
