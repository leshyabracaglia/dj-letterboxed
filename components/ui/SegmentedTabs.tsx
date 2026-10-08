import { Pressable, View } from "react-native";

import { Text } from "./Text";

/** A row of equal-width dark tabs (Following / Popular, DJs / Events…). The
 * selected one sits a shade darker with a glowing white underline. */
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
    <View className="flex-row gap-2">
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={`flex-1 items-center rounded-lg border-b-2 py-2.5 active:opacity-80 ${
              selected
                ? "border-paper bg-[#1E0F14] shadow-md shadow-white/30"
                : "border-transparent bg-zine-panel/80"
            }`}
          >
            <Text
              className={`font-display text-lg uppercase tracking-wide ${
                selected ? "text-paper" : "text-paper/45"
              }`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
