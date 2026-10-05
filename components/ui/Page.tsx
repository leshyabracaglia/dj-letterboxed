import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { cssInterop, useColorScheme } from "nativewind";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";

import { PageHeader } from "./PageHeader";

// NativeWind only maps className -> style for components it knows about, and
// safe-area-context's SafeAreaView isn't one: without this, its flex-1 and
// background were silently dropped on native, so a page shrank to its
// content height and left the stack's bare background showing below it.
// Registered here (module load of the components/ui barrel) so every
// SafeAreaView in the app gets it, not just Page's.
cssInterop(SafeAreaView, { className: "style" });

// Web-only; cast because RN's ViewStyle doesn't declare CSS filter strings.
const DARK_GLOW = { filter: "blur(90px)" } as ViewStyle;

// A blur over a flat single-color page looks identical to that flat color —
// there's nothing for it to distort. Real glass needs something colorful
// moving underneath to reveal. These are large, fairly saturated color
// blobs smeared into soft glows by a heavy blur layered on top, giving
// Card/GlassSurface something to actually show through when they sit above
// this. Uses tint="default" (not "dark"/"light") — those cap their own
// built-in overlay at 78% opacity at high intensity, which was smothering
// the blobs almost entirely; "default" caps at 30% regardless of intensity.
//
// Dark mode on web gets a much fainter version — just enough violet behind
// the cards for their blur/saturate to have something to pick up, while
// the page still reads as black. The blobs are blurred with a CSS filter
// directly rather than a BlurView overlay, since every BlurView tint lays
// its own gray/white wash over the page, which would lift it off true
// black. Native dark mode skips this entirely.
function AmbientBackground() {
  const { colorScheme } = useColorScheme();
  if (colorScheme === "dark") {
    if (Platform.OS !== "web") return null;
    return (
      <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
        <View className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-accent/25" style={DARK_GLOW} />
        <View className="absolute -right-16 top-52 h-72 w-72 rounded-full bg-accent/15" style={DARK_GLOW} />
        <View className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-accent/20" style={DARK_GLOW} />
      </View>
    );
  }

  return (
    <View className="absolute inset-0 overflow-hidden" pointerEvents="none">
      <View className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-accent/50" />
      <View className="absolute -right-16 top-52 h-72 w-72 rounded-full bg-primary/45" />
      <View className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-accent/40" />
      <BlurView intensity={100} tint="default" style={StyleSheet.absoluteFill} />
    </View>
  );
}

// Standard screen shell: safe area, themed background, optional ambient glow
// and optional title header. Put a FlatList/ScrollView (with
// usePageContentStyle) or a PageHeader + list inside as children.
export function Page({
  title,
  header,
  ambient = false,
  className = "",
  children,
}: {
  title?: string;
  // Extra header content rendered under the title (tabs, search box…).
  header?: ReactNode;
  ambient?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    // No bottom edge: on tab screens the tab bar already covers the home
    // indicator inset, so padding it here left a dead, non-scrolling strip
    // above the tabs. Scroll content picks the inset up instead (see
    // usePageContentStyle) so it can still scroll clear of the indicator.
    <SafeAreaView
      edges={["top", "left", "right"]}
      className={`flex-1 bg-paper dark:bg-ink ${className}`}
    >
      {ambient && <AmbientBackground />}
      {!!title && <PageHeader title={title}>{header}</PageHeader>}
      {children}
    </SafeAreaView>
  );
}
