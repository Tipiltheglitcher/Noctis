/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../PC/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI Variable', 'Segoe UI', '-apple-system', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
        },
      },
      boxShadow: {
        glow: '0 0 28px -6px rgb(var(--accent-rgb) / 0.35)',
        card: '0 10px 30px -12px rgba(0, 0, 0, 0.75)',
      },
    },
  },
  plugins: [],
};
