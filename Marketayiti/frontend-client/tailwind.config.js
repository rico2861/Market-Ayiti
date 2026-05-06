/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        surface: { DEFAULT: '#161b22', 2: '#1c2333', 3: '#21262d' },
        accent: { DEFAULT: '#1f6feb', light: '#388bfd' },
        success: '#3fb950',
        danger:  '#f85149',
        warning: '#d29922',
        purple:  '#a371f7'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
