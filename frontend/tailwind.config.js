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
        // Ink & Indigo — Section 2 design tokens
        deep: {
          DEFAULT: "#12142B",
          soft: "#1A1C38",
        },
        ink: {
          DEFAULT: "#1B1D2E",
          muted: "#2A2C42",
        },
        paper: {
          DEFAULT: "#F7F4EC",
          muted: "#A9AAC7",
        },
        dusk: {
          DEFAULT: "#5B5D74",
          soft: "#A9AAC7",
        },
        // Primary accent — Guardian Violet (buttons, links, active). Never body text.
        brand: {
          DEFAULT: "#8B7FE8",
          dark: "#5C52C4",
          light: "#A8A0F0",
          soft: "#E8E5FA",
        },
        // Verification signal only
        aurora: {
          DEFAULT: "#3FC7B8",
          soft: "#C5F2EC",
          muted: "#2A9E92",
        },
        // Collective threshold (guardian quorum) — same family as brand
        threshold: {
          DEFAULT: "#8B7FE8",
          soft: "#A8A0F0",
          muted: "#5C52C4",
        },
        ember: {
          DEFAULT: "#D9614F",
          soft: "#F5D4CE",
        },
        // Ceremonial gold — thin lines, icons, badges ONLY. Never text bg or body color.
        ceremonial: {
          DEFAULT: "#D4A548",
          soft: "#F0E4C4",
        },
        // Light operational surfaces
        glacier: {
          DEFAULT: "#EFEBF8",
          soft: "#F7F4EC",
        },
        frost: {
          DEFAULT: "#F7F4EC",
          muted: "#EFEBF8",
        },
        sage: {
          DEFAULT: "#3FC7B8",
          soft: "#C5F2EC",
        },
        amber: {
          warn: "#D4A548",
          soft: "#F0E4C4",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // Floor: body never under 16px via text-base
        xs: ["0.8125rem", { lineHeight: "1.5" }],
        sm: ["0.9375rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.125rem", { lineHeight: "1.6" }],
        xl: ["1.25rem", { lineHeight: "1.5" }],
        "2xl": ["1.5rem", { lineHeight: "1.4" }],
        "3xl": ["1.875rem", { lineHeight: "1.3" }],
        "4xl": ["2.25rem", { lineHeight: "1.25" }],
        "5xl": ["3rem", { lineHeight: "1.15" }],
        "6xl": ["3.75rem", { lineHeight: "1.1" }],
        "7xl": ["4.5rem", { lineHeight: "1.05" }],
        "8xl": ["6rem", { lineHeight: "1" }],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(18, 20, 43, 0.04), 0 8px 24px rgba(18, 20, 43, 0.06)",
        lift: "0 4px 16px rgba(18, 20, 43, 0.08), 0 12px 32px rgba(92, 82, 196, 0.1)",
        glass: "0 8px 32px rgba(18, 20, 43, 0.16)",
        nav: "0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px rgba(18, 20, 43, 0.4)",
        brand: "0 8px 28px rgba(92, 82, 196, 0.28)",
        aurora: "0 8px 28px rgba(63, 199, 184, 0.28)",
        threshold: "0 8px 28px rgba(139, 127, 232, 0.28)",
      },
      backgroundImage: {
        "frost-mesh":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139, 127, 232, 0.07), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(247, 244, 236, 0.95), transparent), linear-gradient(180deg, #F7F4EC 0%, #EFEBF8 100%)",
        "deep-sheen":
          "linear-gradient(135deg, #12142B 0%, #1A1C38 45%, #12142B 100%)",
        "deep-aurora":
          "radial-gradient(ellipse 70% 55% at 15% 20%, rgba(139, 127, 232, 0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 10%, rgba(63, 199, 184, 0.08), transparent 50%), radial-gradient(ellipse 60% 50% at 70% 90%, rgba(92, 82, 196, 0.1), transparent 55%), linear-gradient(160deg, #12142B 0%, #1A1C38 50%, #12142B 100%)",
        "brand-glow":
          "linear-gradient(135deg, #5C52C4 0%, #8B7FE8 100%)",
        observatory:
          "radial-gradient(ellipse 70% 55% at 20% 0%, rgba(139, 127, 232, 0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(92, 82, 196, 0.08), transparent 50%), linear-gradient(180deg, #EFEBF8 0%, #F7F4EC 100%)",
        "hero-grid":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "hero-grid": "48px 48px",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
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
          "50%": { transform: "translateY(-8px)" },
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
          "50%": { transform: "translate(3%, -2%) scale(1.04)" },
        },
        auroraDriftAlt: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-2%, 3%) scale(1.03)" },
        },
        tabSlideInRight: {
          "0%": { opacity: "0", transform: "translateX(18px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        tabSlideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-18px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        cipherDissolve: {
          "0%": { opacity: "1", filter: "blur(0)", letterSpacing: "0em" },
          "45%": { opacity: "0.35", filter: "blur(3px)", letterSpacing: "0.08em" },
          "100%": { opacity: "0", filter: "blur(6px)", letterSpacing: "0.16em" },
        },
        cipherReveal: {
          "0%": { opacity: "0", filter: "blur(6px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        shardPulse: {
          "0%, 100%": { opacity: "0.35", strokeDashoffset: "12" },
          "50%": { opacity: "0.9", strokeDashoffset: "0" },
        },
        nodeGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(139, 127, 232, 0.3)" },
          "50%": { boxShadow: "0 0 0 6px rgba(139, 127, 232, 0)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fadeIn 0.4s ease-out both",
        "soft-pulse": "softPulse 3s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
        shimmer: "shimmer 3.5s linear infinite",
        "draw-check": "drawCheck 0.8s ease-out 0.4s both",
        "aurora-drift": "auroraDrift 16s ease-in-out infinite",
        "aurora-drift-alt": "auroraDriftAlt 20s ease-in-out infinite",
        "tab-slide-in-right": "tabSlideInRight 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "tab-slide-in-left": "tabSlideInLeft 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "cipher-dissolve": "cipherDissolve 1.6s ease-in-out both",
        "cipher-reveal": "cipherReveal 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "shard-pulse": "shardPulse 2.8s ease-in-out infinite",
        "node-glow": "nodeGlow 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
