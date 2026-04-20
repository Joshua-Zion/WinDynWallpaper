/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f0f1a',
          secondary: '#1a1a2e',
          card: '#242442'
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5'
        }
      }
    }
  },
  plugins: []
}
