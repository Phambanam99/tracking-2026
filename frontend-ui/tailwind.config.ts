import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#0b1220",
        ink: "#e2e8f0",
        accent: "#14b8a6",
      },
    },
  },
  plugins: [],
};

export default config;
