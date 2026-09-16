import { BlurView } from "expo-blur";
import { useColorScheme } from "nativewind";
import { StyleSheet, View } from "react-native";

// A blur over a flat single-color page looks identical to that flat color —
// there's nothing for it to distort. Real glass needs something colorful
// moving underneath to reveal. These are large, fairly saturated color
// blobs smeared into soft glows by a heavy blur layered on top, giving
// Card/GlassSurface something to actually show through when they sit above
// this. Uses tint="default" (not "dark"/"light") — those cap their own
// built-in overlay at 78% opacity at high intensity, which was smothering
// the blobs almost entirely; "default" caps at 30% regardless of intensity.
//
// Dark mode skips this entirely — the background should read as actual
// black, not black-with-a-purple-glow. Cards still read as glass there
// via their own translucent white overlay + blur against the black page.
export function AmbientBackground() {
  const { colorScheme } = useColorScheme();
  if (colorScheme === "dark") return null;

  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
      <View className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-accent/50" />
      <View className="absolute -right-16 top-52 h-72 w-72 rounded-full bg-primary/45" />
      <View className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-accent/40" />
      <BlurView intensity={100} tint="default" style={StyleSheet.absoluteFill} />
    </View>
  );
}
