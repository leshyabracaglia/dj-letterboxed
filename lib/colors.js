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

// The colors that change with the design picked in Settings (lib/design.tsx):
// the zine above, or violet - one electric violet paper, the second paper a
// near-black panel, lilac ink, and white stamps. Keyed by Tailwind class name.
const designPalettes = {
  zine: {
    primary: colors.primary,
    "primary-dark": colors["primary-dark"],
    accent: colors.accent,
    "accent-text": colors["accent-text"],
    "zine-purple": colors.zine.purple,
    "zine-purple-ink": colors.zine["purple-ink"],
    "zine-red": colors.zine.red,
    "zine-red-ink": colors.zine["red-ink"],
    "stamp-red": colors.stamp.red,
    "stamp-purple": colors.stamp.purple,
  },
  violet: {
    primary: "#5B3DF5",
    "primary-dark": "#D8D1FF",
    accent: "#7B63FF",
    "accent-text": "#4A2FD9",
    "zine-purple": "#5B3DF5",
    "zine-purple-ink": "#D8D1FF",
    "zine-red": "#0E0B0C",
    "zine-red-ink": "#A99BFF",
    "stamp-red": "#F6F6F9",
    "stamp-purple": "#F6F6F9",
  },
};

// The CSS variable a design color is set on ("--color-zine-purple"), as the
// space-separated RGB that `rgb(var(...) / <alpha-value>)` needs.
const colorVar = (name) => `--color-${name}`;
const rgbChannels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

/** Each design's colors as CSS variables, for the app root to set. */
function designVars(design) {
  return Object.fromEntries(
    Object.entries(designPalettes[design]).map(([name, hex]) => [colorVar(name), rgbChannels(hex)]),
  );
}

// What Tailwind builds its classes from: the palette, with every design
// color read from its variable so the classes follow the design.
const v = (name) => `rgb(var(${colorVar(name)}) / <alpha-value>)`;
const tailwindColors = {
  ...colors,
  primary: v("primary"),
  "primary-dark": v("primary-dark"),
  accent: v("accent"),
  "accent-text": v("accent-text"),
  zine: {
    ...colors.zine,
    purple: v("zine-purple"),
    "purple-ink": v("zine-purple-ink"),
    red: v("zine-red"),
    "red-ink": v("zine-red-ink"),
  },
  stamp: { red: v("stamp-red"), purple: v("stamp-purple") },
};

module.exports = { colors, designPalettes, designVars, tailwindColors };
