/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "475px",
      },
      colors: {
        deep: {
          DEFAULT: "#0B132B",
          soft: "#121A33",
        },
        ink: {
          DEFAULT: "#1C2541",
          muted: "#2A3555",
        },
        brand: {
          DEFAULT: "#00B4D8",
          dark: "#0096B4",
          light: "#48CAE4",
          soft: "#90E0EF",
        },
        glacier: {
          DEFAULT: "#E0F2FE",
          soft: "#F0F9FF",
        },
        frost: {
          DEFAULT: "#F4F7FA",
          muted: "#E8EEF4",
        },
        sage: {
          DEFAULT: "#10B981",
          soft: "#D1FAE5",
        },
        amber: {
          warn: "#D97706",
          soft: "#FEF3C7",
        },
      },
      fontFamily: {
        display: ['"DM Sans"', "system-ui", "sans-serif"],
        sans: ['"Source Sans 3"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11, 19, 43, 0.04), 0 8px 24px rgba(11, 19, 43, 0.06)",
        lift: "0 4px 16px rgba(11, 19, 43, 0.08), 0 12px 32px rgba(0, 180, 216, 0.08)",
        glass: "0 8px 32px rgba(11, 19, 43, 0.12)",
        nav: "0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px rgba(11, 19, 43, 0.35)",
      },
      backgroundImage: {
        "frost-mesh":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 180, 216, 0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(224, 242, 254, 0.8), transparent), linear-gradient(180deg, #F4F7FA 0%, #E8EEF4 100%)",
        "deep-sheen":
          "linear-gradient(135deg, #0B132B 0%, #1C2541 55%, #0B132B 100%)",
        "brand-glow":
          "linear-gradient(135deg, #00B4D8 0%, #0096B4 100%)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        softPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.65" },
        },
        holdFill: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.55s ease-out both",
        "soft-pulse": "softPulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
