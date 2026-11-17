import { Pressable, View } from "react-native";

import { Text } from "./Text";

/** A row of tabs (Following / Popular, DJs / Events…): plain words over a
 * hairline, the selected one underlined. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row gap-6 border-b border-paper/15">
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`-mb-px border-b-2 pb-2 active:opacity-80 ${selected ? "border-paper" : "border-transparent"}`}
          >
            <Text variant="display" className={`text-xl ${selected ? "text-paper" : "text-paper/50"}`}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
