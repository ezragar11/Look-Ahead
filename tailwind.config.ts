import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5f",
        },
        status: {
          planned:     "#6b7280",
          "in-progress": "#f59e0b",
          complete:    "#10b981",
          delayed:     "#f97316",
          blocked:     "#ef4444",
          cancelled:   "#374151",
          "needs-follow-up": "#8b5cf6",
          missed:      "#dc2626",
        },
      },
    },
  },
  plugins: [],
};

export default config;
