import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "page-enter": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },

        /* === Cyber 动效：demo 风格 === */
        "cyber-grid-shift": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "60px 60px" },
        },
        "scan-line-down": {
          "0%": { top: "-5%" },
          "100%": { top: "105%" },
        },
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "neon-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 6px hsl(195 100% 50% / 0.4), 0 0 14px hsl(195 100% 50% / 0.18)",
          },
          "50%": {
            boxShadow: "0 0 16px hsl(195 100% 50% / 0.7), 0 0 32px hsl(195 100% 50% / 0.35)",
          },
        },
        "glow-blink": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.92)" },
        },
        "orbit-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "corner-flicker": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "data-flow": {
          "0%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-30" },
        },
        "logo-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        "text-blink": {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "page-enter": "page-enter 0.35s ease-out",
        "fade-in-up": "fade-in-up 0.4s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        /* Cyber */
        "cyber-grid-shift": "cyber-grid-shift 20s linear infinite",
        "scan-line-down": "scan-line-down 4s linear infinite",
        "radar-sweep": "radar-sweep 4s linear infinite",
        "neon-pulse": "neon-pulse 2.4s ease-in-out infinite",
        "glow-blink": "glow-blink 2s ease-in-out infinite",
        "orbit-spin": "orbit-spin 12s linear infinite",
        "corner-flicker": "corner-flicker 3s ease-in-out infinite",
        "data-flow": "data-flow 1.6s linear infinite",
        "logo-pulse": "logo-pulse 3s ease-in-out infinite",
        "text-blink": "text-blink 1s steps(1) infinite",
      },
      boxShadow: {
        "card-sm": "var(--shadow-sm)",
        card: "var(--shadow-md)",
        "card-lg": "var(--shadow-lg)",
        "glow-emerald": "var(--shadow-glow-emerald)",
        "glow-cyan": "var(--shadow-glow-cyan)",
        "glow-success": "var(--shadow-glow-success)",
        "glow-warning": "var(--shadow-glow-warning)",
        "glow-danger": "var(--shadow-glow-danger)",
        "glow-purple": "var(--shadow-glow-purple)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-cool": "var(--gradient-cool)",
        "gradient-success": "var(--gradient-success)",
        "gradient-warning": "var(--gradient-warning)",
        "gradient-danger": "var(--gradient-danger)",
        "gradient-purple": "var(--gradient-purple)",
        "mesh-gradient": "var(--gradient-mesh)",
        "cyber-grid": "linear-gradient(hsl(195 100% 50% / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(195 100% 50% / 0.06) 1px, transparent 1px)",
        "scanline-gradient":
          "linear-gradient(90deg, transparent, hsl(195 100% 50% / 0.5), transparent)",
      },
      backgroundSize: {
        "grid-60": "60px 60px",
        "grid-20": "20px 20px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
