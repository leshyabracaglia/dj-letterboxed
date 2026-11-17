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
  // Electric violet: primary buttons, selected chips, structure.
  primary: "#5B3DF5",
  // Links and icons on the dark wall.
  "primary-dark": "#D8D1FF",
  // Lighter violet accent marks, used sparingly.
  accent: "#7B63FF",
  // Pressed/hovered primary button.
  "accent-text": "#4A2FD9",
  muted: "#8a8a99",
  // Error/success text that stays readable on black.
  "danger-dark": "#F87171",
  "success-dark": "#4ADE80",
  // Sheets and modals, lifted off the black page.
  "surface-dark": "#141012",
  // Stack headers and the tab bar.
  chrome: "#0B0809",
  // The review cards' papers, each with a lighter "ink" for small labels
  // printed on top: the violet one, and the near-black one it alternates
  // with (named purple and red from when they were purple and red paper),
  // plus the near-black panel (DJ page panels, inputs).
  zine: {
    purple: "#5B3DF5",
    "purple-ink": "#D8D1FF",
    red: "#0E0B0C",
    "red-ink": "#A99BFF",
    panel: "#0E0B0C",
  },
  // Ring colors on the Stamp seals: both white now, kept as two so stamps
  // can take turns again if they ever get colors.
  stamp: {
    red: "#F6F6F9",
    purple: "#F6F6F9",
  },
};

module.exports = { colors };
