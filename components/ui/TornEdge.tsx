import { View } from "react-native";

// Deterministic "random" tooth sizes, so an edge doesn't reshuffle on every
// render. Enough teeth to span the widest content column (see layout.ts).
const TEETH = Array.from({ length: 70 }, (_, i) => {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  const r = n - Math.floor(n);
  return { width: 8 + Math.round(r * 10), depth: 0.35 + ((r * 7) % 1) * 0.65 };
});

/** A ragged paper edge hanging off the bottom of a colored block: a row of
 * uneven triangles in that block's color. Place it as the block's last child
 * (it's absolutely positioned just below the block). */
export function TornEdge({ color, height = 10 }: { color: string; height?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: -height + 1, height, overflow: "hidden" }}
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
            borderTopWidth: height * tooth.depth,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: color,
          }}
        />
      ))}
    </View>
  );
}

/** A strip of translucent masking tape stuck over a card's edge. Position it
 * with `style` (top/left/right…); it's absolutely positioned. */
export function Tape({
  rotate = -6,
  width = 80,
  style,
}: {
  rotate?: number;
  width?: number;
  style?: { top?: number; left?: number; right?: number; bottom?: number };
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width,
        height: 22,
        backgroundColor: "rgba(235,232,226,0.18)",
        transform: [{ rotate: `${rotate}deg` }],
        zIndex: 2,
        ...style,
      }}
    />
  );
}
