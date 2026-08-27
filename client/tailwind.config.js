/**
 * Design tokens for the POS/ERP client.
 *
 * Reskinned to match the "SafePOS" design system (Manrope + Hanken Grotesk,
 * a deep forest-green primary, warm off-white surfaces, rounded-xl cards) —
 * the same TOKEN NAMES as before are kept (paper/surface/ink/accent/rule/
 * danger/warning/info) so every existing page, which already builds its UI
 * out of those tokens and the shared .btn-, .card, .chip-, .field- classes
 * in src/index.css, picks up the new look automatically without needing to
 * be rewritten file by file. Only the underlying values changed.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF9F7',        // app background
        surface: '#FFFFFF',      // cards, panels
        'surface-sunken': '#EEEEEC', // sidebar / recessed panels — one shade down from paper
        ink: '#1A1C1B',          // primary text
        'ink-muted': '#5A625F',
        rule: '#E3E2E1',         // borders, dividers (subtle)
        'rule-strong': '#C1C8C5', // stronger dividers, input borders
        accent: '#17352F',       // deep forest green — the single accent color
        'accent-soft': '#DCEBE6',
        'accent-strong': '#0E211D',
        danger: '#BA1A1A',
        'danger-soft': '#FFDAD6',
        warning: '#7A5B12',
        'warning-soft': '#FBF1DE',
        info: '#2B5C8A',
        'info-soft': '#E5EEFF',
      },
      fontFamily: {
        // Display: page titles, empty-state headlines, the wordmark.
        display: ['"Manrope"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Body: the workhorse for dense tables and forms used all day.
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Every amount, quantity, invoice/document number, and phone number
        // in the app renders in this — tabular figures so columns of money
        // actually line up, like a receipt tape.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        icon: ['"Material Symbols Outlined"'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
    },
  },
  plugins: [],
};
