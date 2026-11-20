/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-space': '#0E1531',
        'klein-blue': '#2962FF',
        'electric-lime': '#CCFF58',
        'app-bg': 'var(--app-bg)',
        'app-panel': 'var(--app-panel)',
        'app-border': 'var(--app-border)',
        'app-text': 'var(--text-primary)',
        'app-muted': 'var(--text-secondary)',
        'app-accent': 'var(--app-accent)',
        'app-accent-hover': 'var(--app-accent-hover)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 20s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(50px, -50px) scale(1.1)' },
          '50%': { transform: 'translate(-30px, 30px) scale(0.95)' },
          '75%': { transform: 'translate(-50px, -20px) scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
}