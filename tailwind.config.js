/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#12121a",
        paper: "#f7f6f3",
        // Jade ramp (g-*): primary actions/links/structure.
        primary: "#0A805F", // g-700 — primary buttons, links, focus rings
        "primary-hover": "#075F46", // g-800 — primary hover/pressed
        "primary-vivid": "#18C393", // g-500 — chart fills, meters, decorative marks (never as text)
        "primary-tint": "#EEFBF8", // g-50 — selected rows, tinted panels
        "primary-border": "#B9EFDF", // g-200 — borders on tinted surfaces
        "primary-dark": "#4DD5AF", // g-400 — links/icons in dark mode (10.2:1)
        // Violet ramp (v-*): accent marks, used sparingly.
        accent: "#884ACF", // v-500 — accent marks, second chart series (never as body text)
        "accent-text": "#7131B9", // v-600 — accent text on light backgrounds (7.4:1)
        "accent-dark": "#BA95E4", // v-300 — accent text in dark mode (7.6:1)
        "accent-tint": "#EADEF8", // v-100 — highlight chips, "new" flags
        muted: "#8a8a99",
        danger: "#DC2626",
        "surface-dark": "#1b1b24",
      },
      fontFamily: {
        sans: ["Roboto_400Regular", "sans-serif"],
        display: ["UncialAntiqua_400Regular", "serif"],
      },
    },
  },
  plugins: [],
};
