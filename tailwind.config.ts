import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],

  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        /* =====================================================
           KSS CORE
           ===================================================== */

        app: 'var(--bg-app)',

        surface: {
          DEFAULT: 'var(--bg-surface)',
          raised: 'var(--bg-surface-raised)',
          elevated: 'var(--bg-surface-elevated)',
        },

        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          subtle: 'var(--border-subtle)',
        },

        fg: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },

        /* =====================================================
           KSS ACCENT
           ===================================================== */

        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          fg: 'var(--accent-fg)',
          soft: 'var(--accent-soft)',
        },

        /* =====================================================
           SEMANTIC
           ===================================================== */

        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },

        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
        },

        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
        },

        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
        },

        /* =====================================================
           SHADCN COMPATIBILITY
           ===================================================== */

        primary: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-fg)',
        },

        secondary: {
          DEFAULT: 'var(--bg-surface-raised)',
          foreground: 'var(--text-primary)',
        },

        muted: {
          DEFAULT: 'var(--bg-surface-raised)',
          foreground: 'var(--text-secondary)',
        },

        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: '#ffffff',
        },

        background: 'var(--bg-app)',
        foreground: 'var(--text-primary)',

        input: 'var(--border-strong)',
        ring: 'var(--accent)',

        'primary-foreground': 'var(--accent-fg)',
        'secondary-foreground': 'var(--text-primary)',
        'muted-foreground': 'var(--text-secondary)',
        'destructive-foreground': '#ffffff',

        'accent-foreground': 'var(--accent-fg)',
      },

      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },

      boxShadow: {
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        glass: 'var(--shadow-glass)',
        orange: 'var(--shadow-orange)',
        'orange-hover': 'var(--shadow-orange-hover)',
      },

      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },

      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        spring: 'var(--ease-spring)',
      },
    },
  },

  plugins: [],
};

export default config;
