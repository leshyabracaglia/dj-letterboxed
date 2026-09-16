import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";

export function ScreenHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="px-4 pb-2 pt-6">
      <Text className="mb-3 text-3xl font-display text-ink dark:text-paper">{title}</Text>
      {children}
    </View>
  );
}
