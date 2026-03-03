import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#0b1220",
        ink: "#e2e8f0",
        accent: "#14b8a6",
        glass: {
          bg: "rgba(10, 18, 32, 0.84)",
          hover: "rgba(15, 23, 42, 0.92)",
          border: "rgba(148, 163, 184, 0.14)",
        },
      },
      boxShadow: {
        glass: "0 16px 40px rgba(2, 6, 23, 0.42)",
        elevated: "0 24px 80px rgba(2, 6, 23, 0.55)",
      },
      backdropBlur: {
        glass: "18px",
      },
      keyframes: {
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-18px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "slide-in-left": "slide-in-left 220ms ease-out",
        "slide-in-up": "slide-in-up 240ms ease-out",
        "slide-in-right": "slide-in-right 240ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
