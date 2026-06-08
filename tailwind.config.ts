import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: "#F2E9D8",
        "parchment-dark": "#E8DBC4",
        ink: "#1A1209",
        "ink-light": "#3D2B1F",
        "red-ink": "#8B1A1A",
        "red-ink-light": "#C0392B",
        brass: "#B5860D",
        "storm-grey": "#6B7280",
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
        lovecraftian: ["Lovecraftimus", "serif"],
        journal: ["var(--font-caveat)", "cursive"],
      },
    },
  },
  plugins: [],
};

export default config;
