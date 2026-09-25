import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

// `value` is a 1-5 star rating. Read-only when `onChange` is omitted; a
// non-integer `value` (e.g. an averaged rating) is rounded to the nearest
// whole star for display.
export function RatingStars({
  value,
  onChange,
  size = 20,
}: {
  value: number | null | undefined;
  onChange?: (value: number) => void;
  size?: number;
}) {
  const filled = Math.round(value ?? 0);

  return (
    <View className="flex-row">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const iconName = filled >= starValue ? "star" : "star-outline";

        const star = <Ionicons name={iconName} size={size} color="#884ACF" />;

        if (!onChange) {
          return <View key={i}>{star}</View>;
        }

        return (
          <Pressable key={i} onPress={() => onChange(starValue)} hitSlop={4}>
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
