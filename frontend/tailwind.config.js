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
        // Guardian Ledger — primary surfaces
        deep: {
          DEFAULT: "#0B0E1A",
          soft: "#12162A",
        },
        ink: {
          DEFAULT: "#141827",
          muted: "#1E2438",
        },
        // Authority (guardians, CTAs, admin actions)
        brand: {
          DEFAULT: "#E8B84B",
          dark: "#C99A2E",
          light: "#F0D078",
          soft: "#F7E4B0",
        },
        // Individual proof (encryption, Benaloh, verification)
        aurora: {
          DEFAULT: "#3FDDC4",
          soft: "#9AF0E3",
          muted: "#2BB8A3",
        },
        // Collective threshold (guardian quorum)
        threshold: {
          DEFAULT: "#7C6FF0",
          soft: "#B5AEF8",
          muted: "#5E52D4",
        },
        // Alert — restrained
        ember: {
          DEFAULT: "#E85D4A",
          soft: "#F5C4BC",
        },
        paper: {
          DEFAULT: "#F2F0E9",
          muted: "#8B8FA3",
        },
        // Light marketing / operational surfaces (kept for existing layouts)
        glacier: {
          DEFAULT: "#E8F0F4",
          soft: "#F4F7FA",
        },
        frost: {
          DEFAULT: "#F4F7FA",
          muted: "#E8EEF4",
        },
        sage: {
          DEFAULT: "#3FDDC4",
          soft: "#D1FAF5",
        },
        amber: {
          warn: "#E8B84B",
          soft: "#F7E4B0",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Source Sans 3"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11, 14, 26, 0.04), 0 8px 24px rgba(11, 14, 26, 0.06)",
        lift: "0 4px 16px rgba(11, 14, 26, 0.08), 0 12px 32px rgba(232, 184, 75, 0.1)",
        glass: "0 8px 32px rgba(11, 14, 26, 0.18)",
        nav: "0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px rgba(11, 14, 26, 0.45)",
        brand: "0 8px 28px rgba(232, 184, 75, 0.35)",
        aurora: "0 8px 28px rgba(63, 221, 196, 0.28)",
        threshold: "0 8px 28px rgba(124, 111, 240, 0.28)",
      },
      backgroundImage: {
        "frost-mesh":
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(232, 184, 75, 0.08), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(232, 240, 244, 0.9), transparent), linear-gradient(180deg, #F4F7FA 0%, #E8EEF4 100%)",
        "deep-sheen":
          "linear-gradient(135deg, #0B0E1A 0%, #141827 45%, #0B0E1A 100%)",
        "deep-aurora":
          "radial-gradient(ellipse 70% 55% at 15% 20%, rgba(232, 184, 75, 0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 10%, rgba(63, 221, 196, 0.1), transparent 50%), radial-gradient(ellipse 60% 50% at 70% 90%, rgba(124, 111, 240, 0.12), transparent 55%), linear-gradient(160deg, #0B0E1A 0%, #12162A 50%, #0B0E1A 100%)",
        "brand-glow":
          "linear-gradient(135deg, #E8B84B 0%, #C99A2E 100%)",
        "observatory":
          "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(63, 221, 196, 0.08), transparent 55%), radial-gradient(ellipse 40% 35% at 80% 80%, rgba(124, 111, 240, 0.1), transparent 50%), linear-gradient(180deg, #0B0E1A 0%, #141827 100%)",
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
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(124, 111, 240, 0.35)" },
          "50%": { boxShadow: "0 0 0 6px rgba(124, 111, 240, 0)" },
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
        "cipher-dissolve": "cipherDissolve 1.8s ease-in-out infinite alternate",
        "cipher-reveal": "cipherReveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
        "shard-pulse": "shardPulse 2.4s ease-in-out infinite",
        "node-glow": "nodeGlow 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
