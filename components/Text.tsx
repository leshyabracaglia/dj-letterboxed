import { Text as RNText, type TextProps } from "react-native";

// Google Fonts ships each weight as its own named font file rather than a
// single family RN can pick a weight from, so `font-bold`/`font-semibold`
// className would otherwise silently fall back to Roboto_400Regular's cut on
// native. Map them to the loaded weight explicitly; `font-display` and
// `font-numeric` opt out entirely since Uncial Antiqua and Jersey 10 each
// only ship one weight.
const FONT_BY_WEIGHT_CLASS: Record<string, string> = {
  "font-medium": "Roboto_500Medium",
  "font-semibold": "Roboto_500Medium",
  "font-bold": "Roboto_700Bold",
  "font-extrabold": "Roboto_700Bold",
};

function resolveFontFamily(className: string): string | undefined {
  const classes = className.split(/\s+/);
  if (classes.includes("font-display") || classes.includes("font-numeric")) return undefined;
  const weightClass = classes.find((cls) => cls in FONT_BY_WEIGHT_CLASS);
  return FONT_BY_WEIGHT_CLASS[weightClass ?? ""] ?? "Roboto_400Regular";
}

export function Text({ className = "", style, ...props }: TextProps & { className?: string }) {
  const fontFamily = resolveFontFamily(className);
  return (
    <RNText
      className={className}
      style={fontFamily ? [{ fontFamily }, style] : style}
      {...props}
    />
  );
}
