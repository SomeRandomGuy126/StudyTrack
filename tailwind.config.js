/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50-rgb, 239 246 255) / <alpha-value>)',
          100: 'rgb(var(--brand-100-rgb, 219 234 254) / <alpha-value>)',
          200: 'rgb(var(--brand-200-rgb, 191 219 254) / <alpha-value>)',
          300: 'rgb(var(--brand-300-rgb, 147 197 253) / <alpha-value>)',
          400: 'rgb(var(--brand-400-rgb, 96 165 250) / <alpha-value>)',
          500: 'rgb(var(--brand-500-rgb, 59 130 246) / <alpha-value>)',
          600: 'rgb(var(--brand-600-rgb, 37 99 235) / <alpha-value>)',
          700: 'rgb(var(--brand-700-rgb, 29 78 216) / <alpha-value>)',
          800: 'rgb(var(--brand-800-rgb, 30 64 175) / <alpha-value>)',
          900: 'rgb(var(--brand-900-rgb, 30 58 138) / <alpha-value>)',
          950: 'rgb(var(--brand-950-rgb, 23 37 84) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Figtree', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        slideInLeft: { '0%': { opacity: '0', transform: 'translateX(-20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
      },
    },
  },
  plugins: [],
};
