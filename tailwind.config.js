/** @type {import('tailwindcss').Config} */
const rgb = (v) => ({ opacityValue }) =>
  opacityValue === undefined ? `rgb(var(${v}))` : `rgb(var(${v}) / ${opacityValue})`

const scale = (name, stops) =>
  Object.fromEntries(stops.map((s) => [s, rgb(`--${name}-${s}`)]))

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        accent: scale('accent', [50, 100, 200, 300, 400, 500, 600, 700]),
        sun: scale('sun', [50, 100, 300, 500, 700]),
        ink: scale('ink', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        success: scale('success', [50, 500, 700]),
        warning: scale('warning', [50, 500, 700]),
        danger: scale('danger', [50, 500, 700]),
        info: scale('info', [50, 500, 700]),
        surface: {
          DEFAULT: rgb('--surface'),
          muted: rgb('--surface-muted'),
          sunken: rgb('--surface-sunken'),
        },
        line: rgb('--border'),
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)',
      },
      spacing: {
        sidebar: 'var(--sidebar-width)',
        topbar: 'var(--topbar-height)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'slide-up': 'slide-up .2s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
}
