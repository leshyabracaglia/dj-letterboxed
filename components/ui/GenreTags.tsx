import { View } from "react-native";
import { Text } from "./Text";

export function GenreTags({ genres, limit }: { genres: string[]; limit?: number }) {
  if (genres.length === 0) return null;
  const shown = limit ? genres.slice(0, limit) : genres;

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {shown.map((genre) => (
        <View key={genre} className="rounded-full bg-primary-tint px-2.5 py-1 dark:bg-primary/15">
          <Text className="text-xs font-medium text-primary dark:text-primary-dark">{genre}</Text>
        </View>
      ))}
    </View>
  );
}
