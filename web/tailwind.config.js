/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Minimax primary blue scale ──────────────────────────────────────
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#bfcefb',
          300: '#93aef8',
          400: '#60a5fa',  // sky blue  (#3daeff)
          500: '#3b82f6',  // primary   (--primary-500)
          600: '#2563eb',  // hover     (--primary-600)
          700: '#1456f0',  // brand-6   deep blue CTA
          800: '#1d4ed8',
          900: '#17437d',  // brand-deep
          950: '#0f2060',
        },
        // ── Minimax brand accents ───────────────────────────────────────────
        brand: {
          pink: '#ea5ec1',
          sky:  '#3daeff',
          blue: '#1456f0',
        },
        // ── Neutral / surface / dark scale ─────────────────────────────────
        dark: {
          50:  '#f8f9fa',   // near white
          100: '#f0f0f0',   // secondary bg  (#f0f0f0)
          200: '#e5e7eb',   // border gray
          300: '#d1d5db',
          400: '#8e8e93',   // mid gray / tertiary text
          500: '#45515e',   // secondary text
          600: '#334155',
          700: '#2d3748',
          800: '#222222',   // near black / primary text  (#222222)
          900: '#181e25',   // charcoal / dark bg / footer (#181e25)
          950: '#0d1117',
        },
      },

      // ── Typography ──────────────────────────────────────────────────────
      fontFamily: {
        sans:    ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Outfit', '"DM Sans"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        feature: ['Poppins', '"DM Sans"', 'sans-serif'],
        data:    ['Roboto', '"DM Sans"', 'sans-serif'],
        mono:    ['"SF Mono"', '"Fira Code"', 'Monaco', 'Consolas', 'monospace'],
      },

      // ── Border-radius scale ─────────────────────────────────────────────
      borderRadius: {
        'xl':   '13px',
        '2xl':  '16px',
        '3xl':  '20px',
        '4xl':  '24px',
        'pill': '9999px',
      },

      // ── Shadows (Minimax-spec) ──────────────────────────────────────────
      boxShadow: {
        'soft':        'rgba(0, 0, 0, 0.08) 0px 4px 6px',
        'ambient':     'rgba(0, 0, 0, 0.08) 0px 0px 22.576px',
        'brand-glow':  'rgba(44, 30, 116, 0.16) 0px 0px 15px',
        'elevated':    'rgba(36, 36, 36, 0.08) 0px 12px 16px -4px',
        'directional': 'rgba(44, 30, 116, 0.12) 6.5px 6.5px 15px',
        'sm': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'md': 'rgba(0, 0, 0, 0.08) 0px 4px 6px',
        'lg': 'rgba(0, 0, 0, 0.08) 0px 0px 22.576px',
        'xl': 'rgba(36, 36, 36, 0.08) 0px 12px 16px -4px',
      },

      // ── Animations ──────────────────────────────────────────────────────
      animation: {
        'fade-in':   'fadeIn 0.25s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
        'scale-in':  'scaleIn 0.2s ease-out',
        'slide-down':'slideDown 0.25s ease-out',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                                     '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(8px)' },       '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' },      '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { '0%': { opacity: '0', transform: 'scale(0.96)' },           '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
