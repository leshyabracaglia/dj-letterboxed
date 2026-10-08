import { cssInterop } from "nativewind";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

cssInterop(Animated.View, { className: "style" });

const FADE_MS = 220;
// Only the first screenful staggers; later rows (and rows FlatList remounts
// on scroll-back) come in without waiting.
const STAGGER_MS = 40;
const STAGGER_ROWS = 6;

/** Content arriving after a load: a short fade and lift into place, staggered
 * by `index` down a list. Reanimated's entering animations follow the system
 * reduce-motion setting on their own. */
export function FadeInView({
  index = 0,
  className = "",
  style,
  children,
}: {
  index?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const delay = index < STAGGER_ROWS ? index * STAGGER_MS : 0;
  return (
    <Animated.View entering={FadeInDown.duration(FADE_MS).delay(delay)} className={className} style={style}>
      {children}
    </Animated.View>
  );
}
