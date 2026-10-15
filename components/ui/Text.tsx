import { Text as RNText, type TextProps } from "react-native";

// Google Fonts ships each weight as its own named font file rather than a
// single family RN can pick a weight from, so `font-bold`/`font-semibold`
// className would otherwise silently fall back to Roboto_400Regular's cut on
// native. Map them to the loaded weight explicitly; `font-display`,
// `font-numeric` and `font-hand` opt out entirely since Jersey 10 and
// Permanent Marker each only ship one weight.
const FONT_BY_WEIGHT_CLASS: Record<string, string> = {
  "font-medium": "Roboto_500Medium",
  "font-semibold": "Roboto_500Medium",
  "font-bold": "Roboto_700Bold",
  "font-extrabold": "Roboto_700Bold",
};

function resolveFontFamily(className: string): string | undefined {
  const classes = className.split(/\s+/);
  if (["font-display", "font-numeric", "font-hand"].some((cls) => classes.includes(cls))) return undefined;
  const weightClass = classes.find((cls) => cls in FONT_BY_WEIGHT_CLASS);
  return FONT_BY_WEIGHT_CLASS[weightClass ?? ""] ?? "Roboto_400Regular";
}

export function Text({ className = "", style, ...props }: TextProps & { className?: string }) {
  const fontFamily = resolveFontFamily(className);
  return <RNText className={className} style={fontFamily ? [{ fontFamily }, style] : style} {...props} />;
}
