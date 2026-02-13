import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-syne)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      colors: {
        ink: "#0A0A0F",
        paper: "#F5F3EE",
        accent: "#FF4D00",
        muted: "#8A8A8F",
        surface: "#EFECEA",
        border: "#D8D4CD",
      },
      animation: {
        "slide-in": "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-up": "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        slideIn: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
