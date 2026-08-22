import type { Config } from "tailwindcss";

// Design tokens for the Agent OS console. Deliberately not the
// cream+serif or near-black+single-neon-accent defaults: this is a
// multi-signal operational console (agent/device/finality states all
// have their own semantic color), not a page with one hero accent.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#08090C",
          900: "#0D1016",
          800: "#12151C",
          700: "#1B1F28",
          600: "#252A35",
          500: "#3A404D",
        },
        ink: {
          100: "#EEF0F4",
          300: "#C4C9D4",
          500: "#8A90A0",
          700: "#5B6072",
        },
        signal: {
          active: "#3FD0C9",   // running / connected / healthy
          pending: "#E8A93C",  // waiting / degraded / pending
          blocked: "#E45C5C",  // blocked / revoked / failed
          verified: "#7DD87A", // verified / confirmed
          idle: "#5B6072",     // idle / not configured
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
