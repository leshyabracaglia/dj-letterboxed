/** @type {import('tailwindcss').Config} */
module.exports = {
  // "class" is required, not just preferred: nativewind's manual
  // setColorScheme()/toggleColorScheme() throws unless darkMode is "class".
  // Toggling is wired up in app/_layout.tsx + app/settings.tsx.
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // True black for the dark-mode page background (also light mode's
        // primary text color, which pure black works fine for too).
        ink: "#000000",
        // Cooled from a warm cream (#f7f6f3) to a neutral/cool white so light
        // mode reads as "white" and matches the aluminum ramp's cool undertone —
        // light mode is the white/purple/aluminum/glass mirror of dark mode.
        paper: "#F6F6F9",
        // Primary: actions/links/structure. Retuned from the old aluminum
        // grays to the zine purple; the app is dark-only now (see
        // app/_layout.tsx), so the *-dark variants are what actually show.
        primary: "#7E4FC6", // primary buttons, selected chips (zine purple)
        "primary-hover": "#6A3DB0", // primary hover/pressed
        "primary-vivid": "#A4A0B1", // chart fills, meters, decorative marks (never as text)
        "primary-tint": "#F4F4F6", // selected rows, tinted panels
        "primary-border": "#D7D6DC", // borders on tinted surfaces
        "primary-dark": "#C9B6F5", // links/icons on the dark wall
        // Violet ramp (v-*): accent marks, used sparingly.
        accent: "#884ACF", // v-500 — accent marks, second chart series (never as body text)
        "accent-text": "#7131B9", // v-600 — accent text on light backgrounds (7.4:1)
        "accent-dark": "#BA95E4", // v-300 — accent text in dark mode (7.6:1)
        "accent-tint": "#EADEF8", // v-100 — highlight chips, "new" flags
        muted: "#8a8a99",
        danger: "#DC2626",
        "danger-dark": "#F87171", // dark-mode-safe error red — flat #DC2626 can't hit 4.5:1 vs ink
        success: "#15803d",
        "success-dark": "#4ADE80", // dark-mode-safe success green
        // Purple-tinted charcoal, clearly lighter than ink — dark mode's
        // card/input surface layer needs to visibly lift off the near-black
        // page, not blend into it (mirrors "white" for cards in light mode).
        "surface-dark": "#141012",
        // Zine palette (the cut-and-taped review cards): purple for DJ
        // reviews and DJ-ish panels, red for nights and event-ish panels,
        // each with a lighter "ink" for small labels printed on top of them.
        zine: {
          purple: "#7E4FC6",
          "purple-ink": "#E3D4FF",
          red: "#A5363E",
          "red-ink": "#FFC9CC",
          // Near-black panel (rating levels, inputs, segmented tabs).
          panel: "#0E0B0C",
        },
        // Rubber-stamp ring colors on the rating stamp.
        stamp: {
          red: "#E5484D",
          purple: "#B9A0F0",
        },
      },
      fontFamily: {
        sans: ["Roboto_400Regular", "sans-serif"],
        // Primary font (Jersey 10, a pixel display face): branding/headings
        // via `font-display`, and numeric displays (stats, counts, ratings)
        // via `font-numeric` — see components/Text.tsx for how both opt out
        // of the weight-mapping override.
        display: ["Jersey10_400Regular", "sans-serif"],
        numeric: ["Jersey10_400Regular", "sans-serif"],
      },
    },
  },
  plugins: [],
};
