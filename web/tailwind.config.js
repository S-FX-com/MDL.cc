/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────────
// MDL.cc — Design Tokens
// Sourced from the in-house style guide (Clash Grotesk + Inter, navy/cyan
// palette) and informed by Cloudflare Kumo UI conventions.
// ─────────────────────────────────────────────────────────────────────────────
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Brand ─────────────────────────────────────────────────────────
        // Primary: deep navy. Used for primary buttons, headings, dark surfaces.
        primary: {
          50:  '#eef1f6',
          100: '#d6dde9',
          200: '#aeb9cf',
          300: '#7589ad',
          400: '#3f5985',
          500: '#1e2f47', // tertiary in style guide
          600: '#152340',
          700: '#0c1830', // ★ Primary
          800: '#08112a',
          900: '#04081a',
          950: '#010619', // ★ Base
        },
        // Secondary: periwinkle blue. Used for accent backgrounds, active states.
        secondary: {
          50:  '#eef3ff',
          100: '#dbe5ff',
          200: '#b9ccff',
          300: '#8eaeff',
          400: '#5b8ffe', // ★ Secondary
          500: '#3b73fb',
          600: '#2657ed',
          700: '#1c45cf',
          800: '#1d3ba5',
          900: '#1d3782',
        },
        // Accent: cyan. CTA highlights, gradients, brand spark.
        accent: {
          50:  '#e6faff',
          100: '#c2f2ff',
          200: '#85e6ff',
          300: '#3fd8ff',
          400: '#00c7f9', // ★ Accent
          500: '#00a3d4',
          600: '#0082ad',
          700: '#06678a',
          800: '#0d5371',
          900: '#114660',
        },
        // ── Status ────────────────────────────────────────────────────────
        success: {
          50:  '#e9f8ed',
          100: '#cdefd5',
          400: '#4ec06a',
          500: '#25a745', // ★ Success
          600: '#1d8a39',
          700: '#166c2c',
        },
        danger: {
          50:  '#fde8eb',
          100: '#fac4cb',
          400: '#e9606e',
          500: '#dc3545', // ★ Danger
          600: '#b81f2d',
          700: '#911823',
        },
        warning: {
          50:  '#fff8e1',
          100: '#ffeeb3',
          400: '#ffd54a',
          500: '#ffc10a', // ★ Warning
          600: '#d49d00',
          700: '#a87c00',
        },
        info: {
          50:  '#e6effd',
          100: '#c0d6f9',
          400: '#5587ee',
          500: '#2c61e8', // ★ Info
          600: '#1f49bd',
          700: '#193b96',
        },
        // ── Neutral scale (UI surface, text, borders) ─────────────────────
        neutral: {
          0:   '#ffffff',
          25:  '#fafbfc',
          50:  '#f8f9fa',
          100: '#f0f2f5',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#161616', // ★ Neutral
          950: '#0a0a0a',
          1000:'#000000',
        },
      },

      // ── Typography ─────────────────────────────────────────────────────
      // Display: Clash Grotesk for headings & numerics.
      // Body:    Inter for everything else.
      fontFamily: {
        sans:    ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"Clash Grotesk"', 'Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        body:    ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Style-guide text scale (geometric, ~1.25–1.5×)
        'xxs':  ['11px', { lineHeight: '16px', letterSpacing: '0.02em' }],
        'xs':   ['12px', { lineHeight: '16px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'md':   ['18px', { lineHeight: '28px' }],
        'lg':   ['20px', { lineHeight: '28px' }],
        'xl':   ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        '2xl':  ['30px', { lineHeight: '38px', letterSpacing: '-0.015em' }],
        '3xl':  ['36px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
        '4xl':  ['50px', { lineHeight: '60px', letterSpacing: '-0.025em' }],
        '5xl':  ['60px', { lineHeight: '72px', letterSpacing: '-0.03em' }],
      },

      // ── Spacing (style-guide scale: XS 13.3 · S 20 · M 30 · L 45 · XL 67.5 · XXL 101.25) ─
      spacing: {
        'xs':  '13.3px',
        's':   '20px',
        'm':   '30px',
        'l':   '45px',
        'xl':  '67.5px',
        'xxl': '101.25px',
      },

      // ── Border radius scale ───────────────────────────────────────────
      borderRadius: {
        'xs':  '4px',
        'sm':  '6px',
        'md':  '8px',
        'lg':  '10px',
        'xl':  '14px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
        'pill':'9999px',
      },

      // ── Shadow boxes (m, l, xl) ───────────────────────────────────────
      boxShadow: {
        'xs':       '0 1px 2px rgba(12, 24, 48, 0.04)',
        'sm':       '0 1px 3px rgba(12, 24, 48, 0.06), 0 1px 2px rgba(12, 24, 48, 0.04)',
        'm':        '0 4px 12px rgba(12, 24, 48, 0.06), 0 1px 3px rgba(12, 24, 48, 0.04)',
        'l':        '0 12px 24px -4px rgba(12, 24, 48, 0.10), 0 4px 8px -2px rgba(12, 24, 48, 0.04)',
        'xl':       '0 24px 48px -12px rgba(12, 24, 48, 0.18), 0 8px 16px -4px rgba(12, 24, 48, 0.06)',
        'glow':     '0 0 0 1px rgba(91, 143, 254, 0.20), 0 8px 24px rgba(0, 199, 249, 0.16)',
        'focus':    '0 0 0 3px rgba(91, 143, 254, 0.25)',
        'focus-accent': '0 0 0 3px rgba(0, 199, 249, 0.30)',
        // Backwards-compatible aliases
        'soft':     '0 4px 12px rgba(12, 24, 48, 0.06)',
        'elevated': '0 12px 24px -4px rgba(12, 24, 48, 0.10)',
      },

      // ── Animations ─────────────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.20s ease-out',
        'slide-up':   'slideUp 0.22s ease-out',
        'slide-down': 'slideDown 0.22s ease-out',
        'scale-in':   'scaleIn 0.18s ease-out',
        'shimmer':    'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' },                                '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(8px)' },  '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { '0%': { opacity: '0', transform: 'scale(0.96)' },      '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer:   { '0%': { backgroundPosition: '-400px 0' },              '100%': { backgroundPosition: '400px 0' } },
      },
    },
  },
  plugins: [],
};
