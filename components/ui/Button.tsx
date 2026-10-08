import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

// Primary action: a solid zine-purple block. `className` adds sizing and
// padding (w-full, flex-1, py-3, px-4…) and can lay out children (flex-row
// gap-2…). Children bring their own Text, usually `text-paper`.
export function Button({
  className = "",
  disabled,
  children,
  ...props
}: PressableProps & { className?: string; children?: ReactNode }) {
  return (
    <Pressable
      disabled={disabled}
      className={`items-center justify-center rounded-lg bg-zine-purple shadow-md shadow-black/50 hover:bg-accent-text active:bg-accent-text active:opacity-90 ${
        disabled ? "opacity-50" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </Pressable>
  );
}
