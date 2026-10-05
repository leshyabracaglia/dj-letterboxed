import { Ionicons } from "@expo/vector-icons";
import { cssInterop } from "nativewind";
import type { ComponentProps } from "react";

export type IconName = keyof typeof Ionicons.glyphMap;

// Lets an icon take its color from a text-color className
// (`text-accent-text dark:text-accent-dark`) like the Text beside it,
// instead of a hard-coded hex that ignores dark mode.
cssInterop(Ionicons, {
  className: { target: "style", nativeStyleToProp: { color: true } },
});

export function Icon({
  name,
  size = 16,
  className,
  ...props
}: Omit<ComponentProps<typeof Ionicons>, "name"> & { name: IconName; className?: string }) {
  return <Ionicons name={name} size={size} className={className} {...props} />;
}
