/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Ensure reception utilities always emit (dynamic class strings)
  safelist: [
    { pattern: /^(bg|text|border)-rd-(canvas|surface|sidebar|border|text|muted|inverse|primary|primary-hover|accent|good|good-bg|pending|pending-bg|critical|critical-bg|info|info-bg)$/ },
  ],
  theme: {
    extend: {
      gridTemplateColumns:{
        'auto':'repeat(auto-fill, minmax(200px, 1fr))'
      },
      colors:{
        'primary':'#0ea5e9',
        'admin': '#0ea5e9',
        'dean': '#14b8a6',
        'doctor': '#6366f1',
        'reception': '#2B6CB0',
        'health': '#14b8a6',
        'mc-bg': 'var(--mc-bg)',
        'mc-surface': 'var(--mc-surface)',
        'mc-surface-elevated': 'var(--mc-surface-elevated)',
        'mc-text': 'var(--mc-text)',
        'mc-text-muted': 'var(--mc-text-muted)',
        'mc-border': 'var(--mc-border)',
        'mc-accent': 'var(--mc-accent)',
        // Reception desk — Hospital Navy (CSS vars override under .reception-desk)
        'rd-canvas': 'var(--rd-bg-canvas, #F1F4F8)',
        'rd-surface': 'var(--rd-bg-surface, #FFFFFF)',
        'rd-sidebar': 'var(--rd-bg-sidebar, #0F2744)',
        'rd-border': 'var(--rd-border-hairline, #D5DDE8)',
        'rd-text': 'var(--rd-text-primary, #0F1C2E)',
        'rd-muted': 'var(--rd-text-secondary, #5B6B7C)',
        'rd-inverse': 'var(--rd-text-inverse, #FFFFFF)',
        'rd-primary': 'var(--rd-primary, #2B6CB0)',
        'rd-primary-hover': 'var(--rd-primary-hover, #1E4E8C)',
        'rd-accent': 'var(--rd-accent, #3B82C4)',
        'rd-good': 'var(--rd-status-good, #2F6F62)',
        'rd-good-bg': 'var(--rd-status-good-bg, #E7F0EE)',
        'rd-pending': 'var(--rd-status-pending, #C4832A)',
        'rd-pending-bg': 'var(--rd-status-pending-bg, #FFF3E0)',
        'rd-critical': 'var(--rd-status-critical, #B5452A)',
        'rd-critical-bg': 'var(--rd-status-critical-bg, #FBECEA)',
        'rd-info': 'var(--rd-status-info, #2B6CB0)',
        'rd-info-bg': 'var(--rd-status-info-bg, #E8F0F8)',
      },
      fontFamily: {
        'rd': ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'rd': '2px',
        'rd-sm': '4px',
      }
    },
  },
  plugins: [],
}
