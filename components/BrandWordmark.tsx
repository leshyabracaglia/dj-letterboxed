import { Image, View } from "react-native";

import { Text } from "./ui";

// The record-with-a-star mark (assets/logo-mark.png, rasterized from
// assets/icon-concepts/a-vinyl-star.svg) beside the BeatBox'd name.
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      <Image
        source={require("../assets/logo-mark.png")}
        accessibilityIgnoresInvertColors
        style={{ width: 32, height: 32 }}
      />
      <Text className="font-display text-4xl text-primary dark:text-primary-dark">
        BeatBox&apos;d
      </Text>
    </View>
  );
}
