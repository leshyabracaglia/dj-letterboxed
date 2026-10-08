import type { ReactNode } from "react";
import { View } from "react-native";

import { usePageGutter } from "./layout";
import { Text } from "./Text";

const BORDER = {
  none: "pb-2",
  primary: "border-b border-zine-purple/40 pb-4",
  accent: "border-b border-zine-red/50 pb-4",
} as const;

/** The small right-aligned "CH 01 · FEED" label from the zine headers. */
export function ChannelLabel({ label }: { label: string }) {
  return (
    <Text className="font-display text-base uppercase tracking-wider text-paper/80">{label}</Text>
  );
}

// Top-of-page block aligned to the page gutter. Pass `title` for a standard
// display heading (with an optional `channel` label beside it), or omit it
// and pass custom content (profile/detail headers).
export function PageHeader({
  title,
  channel,
  border = "none",
  children,
}: {
  title?: string;
  channel?: string;
  border?: keyof typeof BORDER;
  children?: ReactNode;
}) {
  const gutter = usePageGutter();
  return (
    <View className={`pt-6 ${BORDER[border]}`} style={{ paddingHorizontal: gutter }}>
      {!!title && (
        <View className="mb-3 flex-row items-center justify-between gap-3">
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
