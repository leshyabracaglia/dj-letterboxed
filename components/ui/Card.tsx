import type { Href } from "expo-router";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { GlassSurface } from "./GlassSurface";

// Dark mode uses a translucent WHITE overlay (not a translucent version of
// the page's own near-black), same as iOS's dark frosted materials — a
// dark-on-dark tint is nearly invisible against an already-dark page. Kept
// fairly transparent (not just semi-opaque) so blur/ambient content can
// still show through instead of being masked by an opaque card face. The
// brighter dark:border-t-* is a light-catching bevel on the top edge — on
// a flat black page there's nothing behind the card to visibly refract, so
// this edge highlight is what actually sells "glass" rather than the blur.
const TINTS = {
  neutral: "border-black/10 bg-white/55 dark:border-white/10 dark:border-t-white/35 dark:bg-white/[0.12]",
  primary:
    "border-primary-border bg-primary-tint/60 dark:border-primary/25 dark:border-t-primary-dark/50 dark:bg-primary-dark/[0.16]",
  accent: "border-accent/50 bg-accent-tint/60 dark:border-accent/30 dark:border-t-accent/60 dark:bg-accent/[0.2]",
};

export function Card({
  href,
  tint = "neutral",
  children,
}: {
  // Omit for a non-interactive card (e.g. a loading skeleton in the same frame).
  href?: Href;
  tint?: keyof typeof TINTS;
  children: ReactNode;
}) {
  const surface = (
    <GlassSurface className={`rounded-2xl border p-4 ${TINTS[tint]}`}>{children}</GlassSurface>
  );
  if (!href) {
    return <View className="mb-3 overflow-hidden rounded-2xl shadow-sm">{surface}</View>;
  }
  return (
    <Link href={href} asChild>
      <Pressable className="mb-3 overflow-hidden rounded-2xl shadow-sm active:opacity-90">
        {surface}
      </Pressable>
    </Link>
  );
}
