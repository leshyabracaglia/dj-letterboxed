import type { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";
import { Image, StyleSheet, View } from "react-native";

import { PageHeader } from "./PageHeader";

// NativeWind only maps className -> style for components it knows about, and
// safe-area-context's SafeAreaView isn't one: without this, its flex-1 and
// background were silently dropped on native, so a page shrank to its
// content height and left the stack's bare background showing below it.
// Registered here (module load of the components/ui barrel) so every
// SafeAreaView in the app gets it, not just Page's.
cssInterop(SafeAreaView, { className: "style" });

const WALL = require("../../assets/concrete-wall.jpg");

/** The concrete wall every screen sits on: the (white) wall photo under a
 * heavy warm-black wash, so its cracks and pitting read as faint texture,
 * with a dim red glow from the top like a club light. Also used by screens
 * that don't render inside a Page (e.g. full-bleed detail headers). */
export function WallBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Explicit 100% size: react-native-web's ImageBackground sized the
          photo to its own pixels, so it didn't stretch over wide windows. */}
      <Image
        source={WALL}
        resizeMode="cover"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(22,14,15,0.7)" }]} />
      <LinearGradient
        colors={["rgba(150,48,56,0.38)", "rgba(150,48,56,0)"]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)"]}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** A full-screen View on the wall, for screens that lay themselves out
 * instead of using Page (the centered auth forms). Each screen needs its
 * own: the navigators paint an opaque theme background behind every screen,
 * so a wall drawn behind the navigator never shows through. */
export function WallView({ children }: { children?: ReactNode }) {
  return (
    <View className="flex-1 bg-ink">
      <WallBackground />
      {children}
    </View>
  );
}

// Standard screen shell: safe area, the concrete wall background and an
// optional title header. Put a FlatList/ScrollView (with usePageContentStyle)
// or a PageHeader + list inside as children.
export function Page({
  title,
  channel,
  header,
  fullBleed = false,
  className = "",
  children,
}: {
  title?: string;
  // Small right-aligned label beside the title ("CH 02 · BROWSE").
  channel?: string;
  // Extra header content rendered under the title (tabs, search box…).
  header?: ReactNode;
  // Let the content run up under the status bar (a full-bleed photo hero);
  // the screen then handles the top inset itself.
  fullBleed?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    // No bottom edge: on tab screens the tab bar already covers the home
    // indicator inset, so padding it here left a dead, non-scrolling strip
    // above the tabs. Scroll content picks the inset up instead (see
    // usePageContentStyle) so it can still scroll clear of the indicator.
    <SafeAreaView
      edges={fullBleed ? ["left", "right"] : ["top", "left", "right"]}
      className={`flex-1 bg-ink ${className}`}
    >
      <WallBackground />
      {!!title && (
        <PageHeader title={title} channel={channel}>
          {header}
        </PageHeader>
      )}
      {children}
    </SafeAreaView>
  );
}
