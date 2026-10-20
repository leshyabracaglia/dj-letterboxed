const { colors } = require("./lib/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // "class" is required: nativewind's setColorScheme() throws otherwise, and
  // app/_layout.tsx uses it to force the dark scheme.
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ["Roboto_400Regular", "sans-serif"],
        // Primary font (Jersey 10, a pixel display face): branding/headings
        // via `font-display`, and numeric displays (stats, counts, ratings)
        // via `font-numeric` — see components/ui/Text.tsx for how both opt out
        // of the weight-mapping override.
        display: ["Jersey10_400Regular", "sans-serif"],
        numeric: ["Jersey10_400Regular", "sans-serif"],
        // Marker handwriting, for things written on by hand (the DJ's name
        // on a review card's polaroid). Single weight, like Jersey 10.
        hand: ["PermanentMarker_400Regular", "cursive"],
      },
    },
  },
  plugins: [],
};
