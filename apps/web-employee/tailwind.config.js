/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Fraunces'", "'Inter'", "system-ui", "sans-serif"],
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "gentle-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 var(--glow-color, rgba(99, 102, 241, 0.35))" },
          "50%": { boxShadow: "0 0 0 14px rgba(99, 102, 241, 0)" },
        },
        "drift-slow": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(20px, 30px) scale(1.08)" },
        },
        "drift-slower": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-25px, -20px) scale(1.05)" },
        },
        sparkle: {
          "0%, 100%": { opacity: "0", transform: "scale(0.4)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "gentle-float": "gentle-float 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse 1.6s ease-out",
        "drift-slow": "drift-slow 9s ease-in-out infinite",
        "drift-slower": "drift-slower 13s ease-in-out infinite",
        sparkle: "sparkle 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
