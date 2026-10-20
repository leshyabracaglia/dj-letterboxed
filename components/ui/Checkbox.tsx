import * as CheckboxPrimitive from "@rn-primitives/checkbox";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "./Icon";

/** A checkbox with its label beside it; tapping the label toggles it too
 * (links inside the label still open). */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Read by screen readers, so give it when `children` has links in it. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <View className="w-full flex-row items-start gap-3">
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        hitSlop={8}
        className={`mt-0.5 size-5 shrink-0 overflow-hidden rounded border-2 ${checked ? "border-primary" : "border-white/30 bg-zine-panel/90"}`}
      >
        <CheckboxPrimitive.Indicator className="size-full items-center justify-center bg-primary">
          <Icon name="checkmark" size={14} className="text-paper" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <Pressable onPress={() => onCheckedChange(!checked)} className="flex-1" accessible={false}>
        {children}
      </Pressable>
    </View>
  );
}
