import { View } from "react-native";
import { Chip } from "./ui";

// A review's tags as outlined chips. `limit` caps how many show, with a "+N"
// chip for the rest (cards keep it to a line; the detail page shows them all).
export function ReviewTags({ tags, limit }: { tags: string[] | undefined; limit?: number }) {
  if (!tags?.length) return null;
  const shown = limit ? tags.slice(0, limit) : tags;
  const hidden = tags.length - shown.length;

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {shown.map((tag) => (
        <Chip key={tag} label={tag} />
      ))}
      {!!hidden && <Chip label={`+${hidden}`} className="border-paper/50" />}
    </View>
  );
}
