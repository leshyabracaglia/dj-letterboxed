import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

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
        const iconName = filled >= starValue ? "star" : filled >= halfValue ? "star-half" : "star-outline";

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
