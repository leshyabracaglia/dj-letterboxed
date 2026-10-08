import { View } from "react-native";
import { Text } from "./Text";

/** An outlined, uppercase pixel-type label — the tag/genre chip on the zine
 * cards. */
export function Chip({ label, className = "" }: { label: string; className?: string }) {
  return (
    <View className={`border-2 border-paper/90 px-1.5 py-0.5 ${className}`}>
      <Text className="font-display text-sm uppercase leading-4 text-paper">{label}</Text>
    </View>
  );
}

export function GenreTags({ genres, limit }: { genres: string[]; limit?: number }) {
  if (!genres.length) return null;
  const shown = limit ? genres.slice(0, limit) : genres;

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {shown.map((genre) => (
        <Chip key={genre} label={genre} />
      ))}
    </View>
  );
}
