/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
        },
      },
      boxShadow: {
        glow: '0 0 24px -6px rgb(var(--accent-rgb) / 0.35)',
      },
    },
  },
  plugins: [],
};
