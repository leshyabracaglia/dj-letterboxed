import { View } from "react-native";
import { Text } from "./ui";

const VIBE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  electric: {
    label: "⚡ Electric",
    bg: "bg-accent-tint dark:bg-accent/15",
    text: "text-accent-text dark:text-accent-dark",
  },
  good: {
    label: "🙂 Good",
    bg: "bg-success/10 dark:bg-success-dark/15",
    text: "text-success dark:text-success-dark",
  },
  average: {
    label: "😐 Average",
    bg: "bg-primary-tint dark:bg-primary/15",
    text: "text-primary-hover dark:text-primary-dark",
  },
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
