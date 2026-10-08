import { Image, View } from "react-native";

import { Text } from "./ui";

// The logo - the red 5 rating stamp (assets/logo-mark.png, rendered by
// scripts/generate-icons.mjs) - beside "BeatBox'd" in glowing pixel type.
// `compact` is the smaller cut for the desktop navbar; `dot` swaps the
// stamp for a plain glowing white dot (the phone feed header).
export function BrandWordmark({
  className = "",
  compact = false,
  dot = false,
}: {
  className?: string;
  compact?: boolean;
  dot?: boolean;
}) {
  return (
    <View className={`flex-row items-center ${compact ? "gap-2" : "gap-3"} ${className}`}>
      {dot ? (
        <View className="h-3.5 w-3.5 rounded-full bg-paper shadow-md shadow-white/70" />
      ) : (
        <Image
          source={require("../assets/logo-mark.png")}
          accessibilityIgnoresInvertColors
          style={{ width: compact ? 36 : 46, height: compact ? 36 : 46 }}
        />
      )}
      <Text
        className={`font-display text-paper ${compact ? "text-4xl leading-10" : "text-5xl leading-[52px]"}`}
        style={{ textShadowColor: "rgba(255,255,255,0.35)", textShadowRadius: 8 }}
      >
        BeatBox&apos;d
      </Text>
    </View>
  );
}
