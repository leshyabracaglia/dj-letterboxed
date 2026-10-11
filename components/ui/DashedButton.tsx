import { Pressable } from "react-native";

import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** Dashed "+ …" button that opens an inline input or adds an item. */
export function DashedButton({
  label,
  icon = "add",
  onPress,
  className = "",
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-center gap-1.5 border border-dashed border-paper/60 px-2 py-1 active:opacity-70 ${className}`}
    >
      <Icon name={icon} size={14} className="text-paper" />
      <Text className="font-display text-base uppercase leading-5 text-paper">{label}</Text>
    </Pressable>
  );
}
