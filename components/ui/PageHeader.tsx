import type { ReactNode } from "react";
import { View } from "react-native";

import { usePageGutter } from "./layout";
import { Text } from "./Text";

/** The small right-aligned "CH 01 · FEED" label from the zine headers. */
export function ChannelLabel({ label }: { label: string }) {
  return <Text className="font-display text-base uppercase tracking-wider text-paper/80">{label}</Text>;
}

// Top-of-page block aligned to the page gutter. Pass `title` for a standard
// display heading (with an optional `channel` label beside it), or omit it
// and pass custom content (profile/detail headers).
export function PageHeader({ title, channel, children }: { title?: string; channel?: string; children?: ReactNode }) {
  const gutter = usePageGutter();
  return (
    <View className="gap-3 pt-6" style={{ paddingHorizontal: gutter }}>
      {!!title && (
        <View className="flex-row items-center justify-between gap-3">
          <Text className="shrink text-4xl font-display text-paper" numberOfLines={1}>
            {title}
          </Text>
          {!!channel && <ChannelLabel label={channel} />}
        </View>
      )}
      {children}
    </View>
  );
}
