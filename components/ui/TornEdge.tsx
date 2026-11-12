import { View } from "react-native";

import { useDesign } from "@/lib/design";

// Deterministic "random" tooth sizes, so an edge doesn't reshuffle on every
// render. Enough teeth to span the widest content column (see layout.ts).
const TEETH = Array.from({ length: 70 }, (_, i) => {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  const r = n - Math.floor(n);
  return { width: 8 + Math.round(r * 10), depth: 0.35 + ((r * 7) % 1) * 0.65 };
});

/** A ragged paper edge hanging off the bottom (or, with `side="top"`, the
 * top) of a colored block: a row of uneven triangles in that block's color.
 * It's absolutely positioned just outside the block. */
export function TornEdge({
  color,
  height = 10,
  side = "bottom",
}: {
  color: string;
  height?: number;
  side?: "top" | "bottom";
}) {
  const top = side === "top";
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [side]: -height + 1,
        height,
        overflow: "hidden",
        alignItems: top ? "flex-end" : "flex-start",
      }}
      className="flex-row"
    >
      {TEETH.map((tooth, i) => (
        <View
          key={i}
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: tooth.width / 2,
            borderRightWidth: tooth.width / 2,
            [top ? "borderBottomWidth" : "borderTopWidth"]: height * tooth.depth,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            [top ? "borderBottomColor" : "borderTopColor"]: color,
          }}
        />
      ))}
    </View>
  );
}

/** A strip of translucent masking tape stuck over a card's edge. Position it
 * with `style` (top/left/right…); it's absolutely positioned. The violet
 * design only tapes on photos: other tape (`onPhoto` unset) isn't drawn. */
export function Tape({
  rotate = -6,
  width = 80,
  onPhoto = false,
  style,
}: {
  rotate?: number;
  width?: number;
  // Holding a photo onto the card, which tape still does in the violet design.
  onPhoto?: boolean;
  style?: { top?: number; left?: number; right?: number; bottom?: number };
}) {
  const { design } = useDesign();
  if (design === "violet" && !onPhoto) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width,
        height: 22,
        backgroundColor: design === "violet" ? "rgba(235,232,226,0.38)" : "rgba(235,232,226,0.18)",
        transform: [{ rotate: `${rotate}deg` }],
        zIndex: 2,
        ...style,
      }}
    />
  );
}
