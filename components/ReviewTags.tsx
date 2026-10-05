import { View } from "react-native";
import { Text } from "./ui";

// A review's tags as pills. `limit` caps how many show, with a "+N" pill
// for the rest (cards keep it to a line; the detail page shows them all).
export function ReviewTags({ tags, limit }: { tags: string[] | undefined; limit?: number }) {
  if (!tags?.length) return null;
  const shown = limit ? tags.slice(0, limit) : tags;
  const hidden = tags.length - shown.length;

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {shown.map((tag) => (
        <View key={tag} className="rounded-full bg-accent-tint px-2.5 py-1 dark:bg-accent/15">
          <Text className="text-xs font-medium text-accent-text dark:text-accent-dark">{tag}</Text>
        </View>
      ))}
      {!!hidden && (
        <View className="rounded-full bg-muted/15 px-2.5 py-1">
          <Text className="text-xs font-medium text-muted">+{hidden}</Text>
        </View>
      )}
    </View>
  );
}
