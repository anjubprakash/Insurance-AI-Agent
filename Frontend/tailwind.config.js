/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        insurance: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          500: '#0284c7',   // Sky Blue
          600: '#0369a1',   // Deep Action Blue
          700: '#1d4ed8',   // Royal Navy
          800: '#1e3a8a',   // Deep Insurance Navy
          900: '#0f172a',   // Slate Navy
        }
      }
    },
  },
  plugins: [],
}
