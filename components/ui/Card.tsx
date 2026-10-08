import type { Href } from "expo-router";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { LoadingFade } from "./Skeleton";
import { TornEdge } from "./TornEdge";

// Zine panels: square-cornered paper in the card palette, tacked to the
// wall at a slight angle. `neutral` is the near-black panel (rating levels,
// people, form sections); `primary`/`accent` are the purple and red paper.
const TINTS = {
  neutral: { className: "bg-zine-panel/90 border border-white/10", color: "#0E0B0C" },
  primary: { className: "bg-zine-purple", color: "#7E4FC6" },
  accent: { className: "bg-zine-red", color: "#A5363E" },
} as const;

// Loading placeholders: the same papers, faded to unprinted stock.
const BLANK_TINTS = {
  neutral: { className: "bg-zine-panel/40 border border-white/5", color: "rgba(14,11,12,0.4)" },
  primary: { className: "bg-zine-purple/30", color: "rgba(126,79,198,0.3)" },
  accent: { className: "bg-zine-red/30", color: "rgba(165,54,62,0.3)" },
} as const;

export type CardTint = keyof typeof TINTS;

export const CARD_COLORS = {
  primary: TINTS.primary.color,
  accent: TINTS.accent.color,
  neutral: TINTS.neutral.color,
};

/** A stable small tilt (in degrees, about ±1) from an id, so a list of cards
 * looks hand-pinned without reshuffling on re-render. */
export function tiltFor(id: string, max = 1): number {
  return ((hash(id) % 21) / 10 - 1) * max;
}

// What goes on each paper color: the light ink for small printed labels,
// and a contrasting placeholder for missing photos (maroon on purple, navy
// on red).
const PAPERS = {
  primary: {
    tint: "primary",
    inkClassName: "text-zine-purple-ink",
    photoPlaceholderClassName: "bg-[#3B0E14]",
    photoSilhouetteClassName: "text-zine-red",
  },
  accent: {
    tint: "accent",
    inkClassName: "text-zine-red-ink",
    photoPlaceholderClassName: "bg-[#2A1D47]",
    photoSilhouetteClassName: "text-[#5B4A99]",
  },
} as const;

export type Paper = (typeof PAPERS)[keyof typeof PAPERS];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Purple and red paper taking turns down a list, by the item's index. */
export function paperAt(index: number): Paper {
  return index % 2 ? PAPERS.accent : PAPERS.primary;
}

/** The paper for a tint handed along from elsewhere (a route param), so a
 * card opened from a list keeps its color; anything else is purple. */
export function paperFor(tint: string | undefined): Paper {
  return tint === PAPERS.accent.tint ? PAPERS.accent : PAPERS.primary;
}

export function Card({
  href,
  tint = "neutral",
  tilt = 0,
  torn = false,
  blank = false,
  className = "",
  children,
}: {
  // Omit for a non-interactive card (e.g. a loading skeleton in the same frame).
  href?: Href;
  tint?: CardTint;
  // Rotation in degrees; see tiltFor.
  tilt?: number;
  // Ragged bottom edge, as if torn out of a magazine.
  torn?: boolean;
  // Faded, unprinted paper for a loading skeleton: no shadow, held back and
  // faded in like Skeleton. Put `tone="paper"` Skeletons on it.
  blank?: boolean;
  // Extra classes for the paper itself (padding, overflow…).
  className?: string;
  children: ReactNode;
}) {
  const { className: tintClass, color } = (blank ? BLANK_TINTS : TINTS)[tint];
  const paper = (
    <View className={`p-4 ${tintClass} ${className}`}>
      {/* First, so anything the card positions over its bottom edge (the
          rating stamp) paints above the torn strip. */}
      {torn && <TornEdge color={color} />}
      {children}
    </View>
  );
  const frame = `${torn ? "mb-10" : "mb-4"} ${blank ? "" : "shadow-lg shadow-black/60"}`;
  const transform = tilt ? [{ rotate: `${tilt}deg` }] : undefined;
  if (blank) {
    return (
      <LoadingFade className={frame}>
        <View style={{ transform }}>{paper}</View>
      </LoadingFade>
    );
  }
  if (!href) {
    return (
      <View className={frame} style={{ transform }}>
        {paper}
      </View>
    );
  }
  return (
    <Link href={href} asChild>
      <Pressable className={`${frame} active:opacity-90`} style={{ transform }}>
        {paper}
      </Pressable>
    </Link>
  );
}
