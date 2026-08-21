import { Pressable, Text, View } from "react-native";

// `value` and `onChange` are in half-star units (1-10). Read-only when
// `onChange` is omitted.
export function RatingStars({
  value,
  onChange,
  size = 20,
}: {
  value: number | null | undefined;
  onChange?: (value: number) => void;
  size?: number;
}) {
  const filled = value ?? 0;

  return (
    <View className="flex-row">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = (i + 1) * 2;
        const halfValue = starValue - 1;
        const symbol =
          filled >= starValue ? "★" : filled >= halfValue ? "⯨" : "☆";

        if (!onChange) {
          return (
            <Text key={i} style={{ fontSize: size, color: "#ff5470" }}>
              {symbol}
            </Text>
          );
        }

        return (
          <Pressable key={i} onPress={() => onChange(starValue)} hitSlop={4}>
            <Text style={{ fontSize: size, color: "#ff5470" }}>{symbol}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
