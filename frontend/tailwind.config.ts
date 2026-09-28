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
        // Palette Mali Wuli : Terre, Vert, Sable
        sable: {
          50:  "#fdf8f0",
          100: "#f9edd8",
          200: "#f2d9b0",
          300: "#e8bf80",
          400: "#dba050",
          DEFAULT: "#c8863a",
        },
        terre: {
          50:  "#f5efe8",
          100: "#e8d5c0",
          200: "#d4a97a",
          300: "#b8784a",
          400: "#8b4e28",
          DEFAULT: "#6b3418",
          600: "#4a2010",
        },
        vert: {
          50:  "#edf5ec",
          100: "#c8e6c5",
          200: "#94cc8e",
          300: "#5aae54",
          DEFAULT: "#2e7d32",
          500: "#1b5e20",
        },
        laterite: {
          DEFAULT: "#c0392b",
          light: "#e74c3c",
        },
      },
      fontFamily: {
        // next/font expose les polices chargées via des variables CSS (layout.tsx) :
        // le nom de famille brut « Inter » / « Playfair Display » ne correspond à
        // aucune police chargée et retombait sur la police système.
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
