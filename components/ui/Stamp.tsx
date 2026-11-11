import { View } from "react-native";

import { Text } from "./Text";
import { colors } from "@/lib/colors";

const RING_COLORS = colors.stamp;

// About how many glyphs fit evenly around the rim at the rim's type size.
const RIM_GLYPHS = 40;
const DEFAULT_RIM = "BEATBOXD · ";

/** The rim text, repeated to run the whole way round. */
function rimText(rim: string): string {
  return rim.repeat(Math.max(1, Math.round(RIM_GLYPHS / rim.length)));
}

/** A rubber-stamp seal: `label` (one line, or a few) in the middle of a
 * black disc, `rim` set around its edge. `labelScale` shrinks (or grows)
 * the label from the size that fills the inner ring. */
export function Stamp({
  label,
  rim = DEFAULT_RIM,
  size = 72,
  color = "red",
  rotate = -8,
  labelScale = 1,
  accessibilityLabel,
}: {
  label: string | string[];
  rim?: string;
  size?: number;
  color?: keyof typeof RING_COLORS;
  rotate?: number;
  labelScale?: number;
  accessibilityLabel: string;
}) {
  const ring = RING_COLORS[color];
  const chars = rimText(rim.toUpperCase()).split("");
  const charSize = Math.max(6, size * 0.1);
  const inset = size * 0.2;
  const lines = typeof label === "string" ? [label] : label;
  const longest = Math.max(...lines.map((line) => line.length));
  // Big for a number, shrinking to keep a word or a few lines inside the
  // inner ring (Jersey 10 runs about half an em wide).
  const fontSize = labelScale * Math.min(size * 0.4, (size * 0.56) / (longest * 0.5), (size * 0.5) / lines.length);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(1.5, size * 0.025),
        borderColor: ring,
        backgroundColor: "#050405",
        transform: [{ rotate: `${rotate}deg` }],
        shadowColor: "#000",
        shadowOpacity: 0.5,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      }}
    >
      {/* Each glyph sits at the top of its own full-size, rotated layer,
          which walks the text around the rim without needing SVG paths. */}
      {chars.map((char, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            alignItems: "center",
            transform: [{ rotate: `${(360 / chars.length) * i}deg` }],
          }}
        >
          <Text
            className="font-display"
            style={{ color: ring, fontSize: charSize, lineHeight: charSize * 1.1, marginTop: size * 0.03 }}
          >
            {char}
          </Text>
        </View>
      ))}
      <View
        style={{
          position: "absolute",
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: size,
          borderWidth: Math.max(1, size * 0.015),
          borderColor: ring,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {lines.map((line, i) => (
          <Text
            key={i}
            className="font-display uppercase text-white"
            style={{ fontSize, lineHeight: fontSize * 1.05 }}
            numberOfLines={1}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}
