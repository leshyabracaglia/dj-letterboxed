import { useColorScheme } from "nativewind";

import { toDateInputValue } from "../../lib/format";
import type { DateInputProps } from "./DateInput";

// Web counterpart of DateInput.tsx: the browser's own date picker, which
// already works in "YYYY-MM-DD". color-scheme themes its calendar popup.
export function DateInput({ value, onChange, maximumDate, className = "" }: DateInputProps) {
  const { colorScheme } = useColorScheme();
  return (
    <input
      type="date"
      value={value}
      max={maximumDate ? toDateInputValue(maximumDate) : undefined}
      onChange={(e) => {
        // Cleared or half-typed dates come through as "" - keep the last valid day.
        if (e.target.value) onChange(e.target.value);
      }}
      className={`font-sans text-base ${className}`}
      style={{ colorScheme: colorScheme === "dark" ? "dark" : "light" }}
    />
  );
}
