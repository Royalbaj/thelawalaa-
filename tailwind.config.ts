import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#F97316",
          yellow: "#FACC15",
          red: "#DC2626",
          green: "#16A34A",
          brown: "#78350F",
          cream: "#FFFBEB",
          dark: "#1C0A00",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "cursive"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        warm: "0 10px 30px -10px rgba(249,115,22,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
