import type { Config } from "tailwindcss";

/** Couleur branchée sur une variable CSS de globals.css (canaux RGB). */
const token = (nom: string) => `rgb(var(--mw-${nom}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens sémantiques du design system (docs/design-system.md).
        // À utiliser pour tout nouveau code ; les palettes historiques
        // ci-dessous restent pour la compatibilité.
        brand: {
          50: token("brand-50"),
          100: token("brand-100"),
          200: token("brand-200"),
          500: token("brand-500"),
          DEFAULT: token("brand"),
          700: token("brand-700"),
          800: token("brand-800"),
        },
        ink: {
          DEFAULT: token("ink"),
          soft: token("ink-soft"),
          muted: token("ink-muted"),
        },
        page: token("page"),
        surface: {
          DEFAULT: token("surface"),
          raised: token("surface-raised"),
          sunken: token("surface-sunken"),
        },
        line: {
          soft: token("line-soft"),
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        bark: {
          DEFAULT: token("bark"),
          400: token("bark-400"),
          700: token("bark-700"),
          900: token("bark-900"),
          line: token("bark-line"),
          text: token("bark-text"),
        },
        gold: token("gold"),
        clay: { DEFAULT: token("clay"), ink: token("clay-ink") },
        danger: token("danger"),
        // Palette historique Mali Wuli : Terre, Vert, Sable
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
      boxShadow: {
        card: "0 1px 2px rgb(var(--mw-ink) / 0.04), 0 1px 3px rgb(var(--mw-ink) / 0.06)",
        raised: "0 12px 32px -12px rgb(var(--mw-ink) / 0.18), 0 2px 6px rgb(var(--mw-ink) / 0.05)",
        overlay: "0 28px 64px -16px rgb(var(--mw-ink) / 0.32)",
      },
      height: { header: "var(--mw-header-h)" },
      keyframes: {
        "mw-apparition": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        apparition: "mw-apparition 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
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
