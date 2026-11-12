import { Pressable, View } from "react-native";

import { Text } from "./Text";
import { useDesign } from "@/lib/design";

/** A row of equal-width dark tabs (Following / Popular, DJs / Events…). The
 * selected one sits a shade darker with a glowing white underline. In the
 * violet design they're plain words over a hairline, the selected one
 * underlined. */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { design } = useDesign();
  if (design === "violet") {
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
            className={`flex-1 items-center rounded-lg border-b-2 py-2.5 shadow-md active:opacity-80 ${
              selected
                ? "border-paper bg-[#1E0F14] shadow-white/30"
                : "border-transparent bg-zine-panel/80 shadow-transparent"
            }`}
          >
            <Text variant="display" className={`text-lg tracking-wide ${selected ? "text-paper" : "text-paper/45"}`}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
