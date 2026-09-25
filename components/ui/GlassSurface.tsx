import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { cssInterop, useColorScheme } from "nativewind";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

cssInterop(GlassView, { className: "style" });

// Web-only CSS properties react-native-web passes straight through; cast
// because RN's ViewStyle doesn't declare backdropFilter/backgroundImage.
const WEB_GLASS_LIGHT = {
  backdropFilter: "blur(20px) saturate(180%)",
  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 55%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.06)",
} as ViewStyle;

const WEB_GLASS_DARK = {
  backdropFilter: "blur(20px) saturate(180%)",
  backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 50%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.5)",
} as ViewStyle;

// Real iOS 26 Liquid Glass where the OS actually provides it — false on
// web, Android, and pre-26 iOS, where GlassView's own fallback is just a
// plain <View> (no effect at all), so those need their own fallbacks below.
const hasNativeGlass = isGlassEffectAPIAvailable();

// expo-blur's BlurView always applies its own computed backgroundColor last
// in its internal style array, silently overriding any bg-* class we'd pass
// it directly — so it can only ever be used as a plain, colorless blur
// layer. The actual brand tint (bg-white/80, dark:bg-white/[0.08], etc.)
// has to live on a separate, normally-flowed sibling stacked on top of it,
// which is what gives the blurred backdrop its frosted color.
export function GlassSurface({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  if (hasNativeGlass) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={isDark ? "dark" : "light"} className={className}>
        {children}
      </GlassView>
    );
  }

  // Web: plain CSS frosted glass. saturate() makes whatever's behind glow
  // through instead of just going gray, the inset shadows are the light-
  // catching top edge / darker bottom edge of a thick pane, and the
  // gradient is a soft static sheen from the top-left. Layered on top of
  // the bg-* tint from className (background-image paints over
  // background-color, so they don't fight).
  if (Platform.OS === "web") {
    return (
      <View className={className} style={isDark ? WEB_GLASS_DARK : WEB_GLASS_LIGHT}>
        {children}
      </View>
    );
  }

  // tint="dark"/"light" caps its own built-in overlay at 78% opacity at
  // high intensity — that was smothering nearly everything behind it before
  // our own tint classes even got a chance to show. tint="default" caps at
  // 30% regardless of intensity. Kept moderate (not maxed) even so: over a
  // flat single-color backdrop there's nothing to actually blur, so a
  // strong intensity here just stacks a second translucent-white wash on
  // top of our own content tint, compounding into flat gray. Our own
  // bg-*/border-* classes below do the real coloring; this just needs to
  // contribute a little blur for screens that do have texture behind them.
  return (
    <View>
      <BlurView intensity={35} tint="default" style={StyleSheet.absoluteFill} />
      <View className={className}>{children}</View>
    </View>
  );
}
