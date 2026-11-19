/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI Variable',
          'Segoe UI',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#060608',
          900: '#0A0A0E',
          850: '#0F0F14',
          800: '#14141B',
          750: '#1A1A23',
          700: '#22222E',
          600: '#2D2D3D',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          soft: 'rgb(var(--accent-rgb) / 0.14)',
        },
      },
      boxShadow: {
        glow: '0 0 28px -6px rgb(var(--accent-rgb) / 0.35)',
        card: '0 10px 30px -12px rgba(0, 0, 0, 0.75)',
      },
      animation: {
        'fade-in': 'fadeIn 0.22s ease-out',
        'slide-up': 'slideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
