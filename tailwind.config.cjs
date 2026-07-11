/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "ex-black": "#1e1e1e",
        "ex-red": "#e03131",
        "ex-green": "#2f9e44",
        "ex-blue": "#1971c2",
        "ex-orange": "#f08c00",
        "ex-purple": "#6741d9"
      }
    }
  },
  darkMode: "class",
  plugins: []
};
