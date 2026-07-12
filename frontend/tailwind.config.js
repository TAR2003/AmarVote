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
        display: ['"Outfit"', "system-ui", "sans-serif"],
        sans: ['"Source Sans 3"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11, 19, 43, 0.04), 0 8px 24px rgba(11, 19, 43, 0.06)",
        lift: "0 4px 16px rgba(11, 19, 43, 0.08), 0 12px 32px rgba(0, 180, 216, 0.08)",
        glass: "0 8px 32px rgba(11, 19, 43, 0.12)",
        nav: "0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px rgba(11, 19, 43, 0.35)",
        brand: "0 8px 28px rgba(0, 180, 216, 0.35)",
      },
      backgroundImage: {
        "frost-mesh":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 180, 216, 0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(224, 242, 254, 0.8), transparent), linear-gradient(180deg, #F4F7FA 0%, #E8EEF4 100%)",
        "deep-sheen":
          "linear-gradient(135deg, #0B132B 0%, #1C2541 45%, #0B132B 100%)",
        "deep-aurora":
          "radial-gradient(ellipse 70% 55% at 15% 20%, rgba(0, 180, 216, 0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 10%, rgba(72, 202, 228, 0.14), transparent 50%), radial-gradient(ellipse 60% 50% at 70% 90%, rgba(0, 150, 180, 0.12), transparent 55%), linear-gradient(160deg, #0B132B 0%, #121A33 50%, #0B132B 100%)",
        "brand-glow":
          "linear-gradient(135deg, #00B4D8 0%, #0096B4 100%)",
        "hero-grid":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "hero-grid": "48px 48px",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        softPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        drawCheck: {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        holdFill: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        auroraDrift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(4%, -3%) scale(1.05)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fadeIn 0.6s ease-out both",
        "soft-pulse": "softPulse 3s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3.5s linear infinite",
        "draw-check": "drawCheck 0.8s ease-out 0.4s both",
        "aurora-drift": "auroraDrift 14s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
