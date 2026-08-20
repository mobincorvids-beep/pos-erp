/** Design tokens for the POS/ERP client — see client/DESIGN.md for the rationale. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF9F6',       // app background — unbleached ledger paper, not stark white
        surface: '#FFFFFF',      // cards, panels
        ink: '#16201D',          // primary text — warm near-black, ties to the accent family
        'ink-muted': '#5B6864',
        rule: '#D8DED9',         // borders, dividers, the receipt "tear line"
        accent: '#0F6B5C',       // ledger green — the single accent color, used deliberately
        'accent-soft': '#E4F1EC',
        'accent-strong': '#0B534A',
        danger: '#A3352B',       // returns, voids, negative amounts
        'danger-soft': '#FBEAE7',
        warning: '#9C6B0A',      // pending, due balances
        'warning-soft': '#FBF1DE',
        info: '#2B5C8A',
      },
      fontFamily: {
        // Display: used ONLY for page titles and empty-state headlines — a
        // handful of instances per screen, so it can carry real character
        // without hurting density elsewhere.
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        // Body: the workhorse for dense tables and forms used all day —
        // legibility at 12–13px wins over novelty here.
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Every amount, quantity, invoice/document number, and phone number
        // in the app renders in this — tabular figures so columns of money
        // actually line up, like a receipt tape. This is the app's signature.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px', // sharp, paper-like — not the soft bubbly SaaS default
        sm: '2px',
        md: '4px',
        lg: '6px',
      },
    },
  },
  plugins: [],
};
