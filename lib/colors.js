// The app's palette, in one place: tailwind.config.js builds its color
// classes from it, and code that needs a raw color (SVG fills, native header
// options, ActivityIndicator) imports it instead of repeating hex values.
// CommonJS so the Tailwind config can require it. The app is dark-only (see
// app/_layout.tsx).
const colors = {
  // The page background, and text on light paper.
  ink: "#000000",
  // Text and icons on the dark wall.
  paper: "#F6F6F9",
  // Zine purple: primary buttons, selected chips, structure.
  primary: "#7E4FC6",
  // Links and icons on the dark wall.
  "primary-dark": "#C9B6F5",
  // Violet accent marks, used sparingly.
  accent: "#884ACF",
  // Pressed/hovered primary button.
  "accent-text": "#7131B9",
  muted: "#8a8a99",
  // Error/success text that stays readable on black.
  "danger-dark": "#F87171",
  "success-dark": "#4ADE80",
  // Sheets and modals, lifted off the black page.
  "surface-dark": "#141012",
  // Stack headers and the tab bar.
  chrome: "#0B0809",
  // The cut-and-taped review cards: purple and red paper, each with a
  // lighter "ink" for small labels printed on top, and the near-black panel
  // (DJ page panels, inputs, segmented tabs).
  zine: {
    purple: "#7E4FC6",
    "purple-ink": "#E3D4FF",
    red: "#A5363E",
    "red-ink": "#FFC9CC",
    panel: "#0E0B0C",
  },
  // Rubber-stamp ring colors on the Stamp seals.
  stamp: {
    red: "#E5484D",
    purple: "#B9A0F0",
  },
};

module.exports = { colors };
