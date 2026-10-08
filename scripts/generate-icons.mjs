// Renders the app's logo - the red "5" rating stamp (components/ui/RatingStamp
// .tsx, drawn here as SVG at icon resolution) - into every icon asset
// app.json points at, plus the favicon and the logo mark. Uses the Playwright
// Chromium the e2e suite already installs, so the stamp's ring text is set in
// the real Jersey 10 font.
//
//   node scripts/generate-icons.mjs
//
// Re-run after changing the stamp's look; it overwrites the files in assets/.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const font = readFileSync(
  `${root}node_modules/@expo-google-fonts/jersey-10/400Regular/Jersey10_400Regular.ttf`,
).toString("base64");

const RED = "#E5484D";
const RING_TEXT = "BEATBOXD · RATED · BEATBOXD · RATED · ";

/** The stamp as an SVG `size` px square: black disc, red rim, the ring text
 * around it, an inner ring and a white 5. Proportions match RatingStamp. With
 * `mono`, everything is drawn in one flat white (Android's themed icon). */
function stampSvg(size, { mono = false, rotate = -8 } = {}) {
  const c = size / 2;
  const rim = size * 0.025;
  const r = c - rim / 2;
  const textSize = size * 0.1;
  // Baseline radius: glyphs hang from just inside the rim, as in the app.
  const textR = c - size * 0.03 - textSize * 0.82;
  const innerR = size * 0.3;
  const fg = mono ? "#FFFFFF" : RED;
  const disc = mono ? "none" : "#050405";
  const five = mono ? "#FFFFFF" : "#FFFFFF";
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <path id="ring" d="M ${c} ${c - textR} A ${textR} ${textR} 0 1 1 ${c} ${c + textR} A ${textR} ${textR} 0 1 1 ${c} ${c - textR}" />
  </defs>
  <g transform="rotate(${rotate} ${c} ${c})" font-family="Jersey10">
    <circle cx="${c}" cy="${c}" r="${r}" fill="${disc}" stroke="${fg}" stroke-width="${rim}" />
    <text font-size="${textSize}" fill="${fg}">
      <textPath href="#ring" textLength="${2 * Math.PI * textR * 0.985}" lengthAdjust="spacing">${RING_TEXT}</textPath>
    </text>
    <circle cx="${c}" cy="${c}" r="${innerR}" fill="none" stroke="${fg}" stroke-width="${size * 0.015}" />
    <text x="${c}" y="${c}" font-size="${size * 0.4}" fill="${five}" text-anchor="middle" dominant-baseline="central">5</text>
  </g>
</svg>`;
}

/** A square `size` canvas with the stamp `scale` of its width, centered, on
 * `background` (null = transparent). */
function iconHtml(size, { scale = 1, background = null, mono = false } = {}) {
  const stamp = Math.round(size * scale);
  return `<!doctype html><html><head><style>
    @font-face { font-family: Jersey10; src: url(data:font/ttf;base64,${font}); }
    html, body { margin: 0; background: transparent; }
    #icon { width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;
            background: ${background ?? "transparent"}; }
  </style></head><body><div id="icon">${stampSvg(stamp, { mono })}</div></body></html>`;
}

// iOS/app-store icon must be opaque; Android's adaptive foreground keeps the
// stamp inside the ~61% safe circle; the rest are transparent.
const ICONS = [
  { file: "icon.png", size: 1024, scale: 0.86, background: "#000000" },
  { file: "splash-icon.png", size: 1024, scale: 0.9 },
  { file: "android-icon-foreground.png", size: 512, scale: 0.6 },
  { file: "android-icon-background.png", size: 512, scale: 0, background: "#000000" },
  { file: "android-icon-monochrome.png", size: 432, scale: 0.6, mono: true },
  { file: "favicon.png", size: 48, scale: 1 },
  { file: "logo-mark.png", size: 256, scale: 1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  const html = icon.scale
    ? iconHtml(icon.size, icon)
    : `<!doctype html><html><body style="margin:0"><div id="icon" style="width:${icon.size}px;height:${icon.size}px;background:${icon.background}"></div></body></html>`;
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#icon").screenshot({ path: `${root}assets/${icon.file}`, omitBackground: !icon.background });
  console.log(`wrote assets/${icon.file}`);
}
await browser.close();
