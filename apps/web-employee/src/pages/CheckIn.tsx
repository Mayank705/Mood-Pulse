import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api, ApiClientError } from "../api/client";
import { MOOD_OPTIONS, MoodLevel, TodayStatus } from "../types";
import EmojiOption from "../components/EmojiOption";
import AmbientBackground from "../components/AmbientBackground";
import { themeFor } from "../theme/moodTheme";

type Phase = "loading" | "closed" | "form" | "submitting" | "confirmed" | "error";

const COMMENT_LIMIT = 500;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function CheckIn() {
  const { user, token } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const theme = themeFor(selectedMood);

  const loadStatus = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await api.get<TodayStatus>("/api/mood-responses/today", token);
      setStatus(res);
      if (res.alreadySubmitted || !res.shouldPrompt) {
        setPhase("closed");
      } else {
        const delay = (res.promptDelaySeconds ?? 0) * 1000;
        if (delay > 0) {
          setTimeout(() => setPhase("form"), delay);
        } else {
          setPhase("form");
        }
      }
    } catch {
      setErrorMessage("We couldn't load your check-in right now. Please try again.");
      setPhase("error");
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleSubmit() {
    if (!selectedMood) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      await api.post("/api/mood-responses", token, { mood: selectedMood, comment: comment.trim() || undefined });
      setPhase("confirmed");
      // Give the employee a moment to see the confirmation, then step back
      // out of the way. A packaged Windows agent build (Electron/WebView2)
      // would call its native "minimize/close host window" bridge here;
      // in a plain browser tab the closest equivalent is window.close(),
      // which only succeeds for a script-opened window.
      setTimeout(() => {
        window.close();
      }, 3500);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setPhase("closed");
        return;
      }
      setErrorMessage("We couldn't save your response right now. Please try again.");
      setPhase("form");
    }
  }

  if (phase === "loading") {
    return (
      <CenteredCard theme={theme}>
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
          <p className="text-sm">Getting things ready…</p>
        </div>
      </CenteredCard>
    );
  }

  if (phase === "error") {
    return (
      <CenteredCard theme={theme}>
        <p className="text-4xl mb-3">🔄</p>
        <p className="text-slate-600 text-center mb-5">{errorMessage}</p>
        <button
          onClick={loadStatus}
          className="rounded-full bg-indigo-600 text-white px-6 py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      </CenteredCard>
    );
  }

  if (phase === "closed") {
    return (
      <CenteredCard theme={theme}>
        <p className="text-4xl mb-3 animate-pop-in">👋</p>
        <p className="text-slate-600 text-center">
          {status?.alreadySubmitted ? "You're all set for today. See you tomorrow!" : "Check back during tomorrow's check-in window."}
        </p>
      </CenteredCard>
    );
  }

  if (phase === "confirmed") {
    return (
      <CenteredCard theme={theme}>
        <div className="relative animate-pop-in flex flex-col items-center py-2">
          <Sparkles />
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-800 mb-2 text-balance">
            Thanks for checking in! 💙
          </h1>
          <p className="text-slate-500">Your response has been recorded.</p>
        </div>
      </CenteredCard>
    );
  }

  // phase === "form" | "submitting"
  return (
    <CenteredCard theme={theme} wide>
      <p className="text-sm font-medium text-slate-400 mb-1">
        {greeting()} {user?.name?.split(" ")[0] ?? ""} 👋
      </p>
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-800 mb-6 sm:mb-8 text-balance">
        How are you feeling today?
      </h1>

      <div className="grid grid-cols-5 gap-1 sm:gap-3 mb-6 sm:mb-8" role="radiogroup" aria-label="How are you feeling today?">
        {MOOD_OPTIONS.map((option) => (
          <EmojiOption key={option.mood} option={option} selected={selectedMood === option.mood} onSelect={() => setSelectedMood(option.mood)} />
        ))}
      </div>

      <div className="mb-6">
        <label htmlFor="comment" className="block text-xs font-medium text-slate-400 mb-2">
          Want to tell us more? (Optional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_LIMIT))}
          maxLength={COMMENT_LIMIT}
          rows={3}
          placeholder="Share a little more (optional)"
          className="checkin-textarea w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-colors resize-none"
          style={{ "--focus-ring": theme.glow } as React.CSSProperties}
        />
        <p className="text-right text-[11px] text-slate-300 mt-1">
          {comment.length}/{COMMENT_LIMIT}
        </p>
      </div>

      {errorMessage && <p className="text-sm text-rose-500 mb-4 text-center">{errorMessage}</p>}

      <button
        onClick={handleSubmit}
        disabled={!selectedMood || phase === "submitting"}
        style={selectedMood ? { backgroundColor: theme.accent, boxShadow: `0 12px 24px -8px ${theme.glow}` } : undefined}
        className="w-full rounded-full text-white py-3.5 text-sm font-semibold tracking-wide transition-all duration-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none hover:brightness-95"
      >
        {phase === "submitting" ? "Submitting…" : "Submit"}
      </button>
    </CenteredCard>
  );
}

function Sparkles() {
  const positions = [
    { top: "-6px", left: "18%", delay: "0s" },
    { top: "10px", left: "82%", delay: "0.3s" },
    { top: "-14px", left: "50%", delay: "0.6s" },
    { top: "20px", left: "6%", delay: "0.9s" },
    { top: "6px", left: "92%", delay: "1.2s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-10 motion-reduce:hidden" aria-hidden="true">
      {positions.map((p, i) => (
        <span
          key={i}
          className="absolute text-sm animate-sparkle"
          style={{ top: p.top, left: p.left, animationDelay: p.delay }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}

function CenteredCard({
  children,
  wide,
  theme,
}: {
  children: React.ReactNode;
  wide?: boolean;
  theme: ReturnType<typeof themeFor>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative">
      <AmbientBackground theme={theme} />
      <div
        className={`w-full ${wide ? "max-w-md sm:max-w-lg" : "max-w-sm"} rounded-[2rem] bg-white/90 backdrop-blur-sm shadow-2xl shadow-slate-200/60 border border-white p-6 sm:p-10 flex flex-col items-center transition-shadow duration-500`}
      >
        {children}
      </div>
    </div>
  );
}
