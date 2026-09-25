import type { ReactNode } from "react";
import { View } from "react-native";

import { usePageGutter } from "./layout";
import { Text } from "./Text";

const BORDER = {
  none: "pb-2",
  primary: "border-b border-primary/15 pb-4",
  accent: "border-b border-accent/15 pb-4",
} as const;

// Top-of-page block aligned to the page gutter. Pass `title` for a standard
// display heading, or omit it and pass custom content (profile/detail headers).
export function PageHeader({
  title,
  border = "none",
  children,
}: {
  title?: string;
  border?: keyof typeof BORDER;
  children?: ReactNode;
}) {
  const gutter = usePageGutter();
  return (
    <View className={`pt-6 ${BORDER[border]}`} style={{ paddingHorizontal: gutter }}>
      {title ? (
        <Text className="mb-3 text-3xl font-display text-ink dark:text-paper">{title}</Text>
      ) : null}
      {children}
    </View>
  );
}
