import { Pressable, View } from "react-native";

import { Text } from "./Text";

const RING_TEXT = "BEATBOXD · RATED · BEATBOXD · RATED · ";

const RING_COLORS = {
  red: "#E5484D",
  purple: "#B9A0F0",
} as const;

// Odd ratings stamp in red, even in purple, so a column of stamps alternates
// like the mockup's 1-5 sheet.
function defaultColor(value: number): keyof typeof RING_COLORS {
  return Math.round(value) % 2 === 0 ? "purple" : "red";
}

/** A rubber-stamp rating seal: the rating in the middle of a black disc,
 * "BEATBOXD · RATED" set around its rim. `value` may be an average (shown to
 * one decimal); null shows a dash. */
export function RatingStamp({
  value,
  size = 72,
  color,
  rotate = -8,
}: {
  value: number | null | undefined;
  size?: number;
  color?: keyof typeof RING_COLORS;
  rotate?: number;
}) {
  const ring = RING_COLORS[color ?? defaultColor(value ?? 1)];
  const label = !value ? "–" : Number.isInteger(value) ? String(value) : value.toFixed(1);
  const chars = RING_TEXT.split("");
  const charSize = Math.max(6, size * 0.1);
  const inset = size * 0.2;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={value ? `Rated ${label} out of 5` : "Not rated yet"}
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
        <Text
          className="font-display text-white"
          style={{ fontSize: size * (label.length > 1 ? 0.3 : 0.4), lineHeight: size * 0.46 }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Picking a 1-5 rating: the five stamps in a row (the "ring" sheet), the
 * chosen one full strength and the rest faded back. */
export function RatingStampPicker({
  value,
  onChange,
  size = 54,
}: {
  value: number | null | undefined;
  onChange: (value: number) => void;
  size?: number;
}) {
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${n} out of 5`}
            hitSlop={4}
            style={{ opacity: !value || selected ? 1 : 0.35, transform: [{ scale: selected ? 1.1 : 1 }] }}
          >
            <RatingStamp value={n} size={size} rotate={selected ? -8 : 0} />
          </Pressable>
        );
      })}
    </View>
  );
}
