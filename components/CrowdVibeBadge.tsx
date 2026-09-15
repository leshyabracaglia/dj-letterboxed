import { View } from "react-native";
import { Text } from "./Text";

const VIBE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  electric: { label: "⚡ Electric", bg: "bg-accent-tint", text: "text-accent-text" },
  good: { label: "🙂 Good", bg: "bg-emerald-100", text: "text-emerald-700" },
  average: { label: "😐 Average", bg: "bg-amber-100", text: "text-amber-700" },
  dead: { label: "💀 Dead", bg: "bg-muted/20", text: "text-muted" },
};

export function CrowdVibeBadge({ vibe }: { vibe: string | null | undefined }) {
  if (!vibe || !VIBE_STYLES[vibe]) return null;
  const { label, bg, text } = VIBE_STYLES[vibe];

  return (
    <View className={`self-start rounded-full px-3 py-1 ${bg}`}>
      <Text className={`text-xs font-medium ${text}`}>{label}</Text>
    </View>
  );
}
