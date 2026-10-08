import { cssInterop } from "nativewind";
import { useEffect, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  makeMutable,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

cssInterop(Animated.View, { className: "style" });

const PULSE_MS = 1000;
// Placeholders stay invisible this long, so a fast load goes straight from
// nothing to content instead of flashing a skeleton for a frame or two.
const APPEAR_DELAY_MS = 250;
const APPEAR_MS = 180;

// One pulse shared by every mounted Skeleton, so all the blocks on screen
// breathe together instead of drifting out of phase. It runs while at least
// one Skeleton is mounted.
const pulse = makeMutable(1);
let pulseUsers = 0;

function usePulse(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (pulseUsers++ === 0) {
      pulse.value = withRepeat(
        withSequence(withTiming(0.5, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })),
        -1,
      );
    }
    return () => {
      if (--pulseUsers === 0) {
        cancelAnimation(pulse);
        pulse.value = 1;
      }
    };
  }, [enabled]);
}

// 0 → 1 after APPEAR_DELAY_MS, for a placeholder's opacity.
function useAppear() {
  const reduceMotion = useReducedMotion();
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(APPEAR_DELAY_MS, withTiming(1, { duration: reduceMotion ? 0 : APPEAR_MS }));
  }, [appear, reduceMotion]);
  return appear;
}

/** Holds loading chrome (a blank card, a placeholder band) back for the same
 * short delay as Skeleton, then fades it in. */
export function LoadingFade({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const appear = useAppear();
  const fade = useAnimatedStyle(() => ({ opacity: appear.value }));
  return (
    <Animated.View style={[style, fade]} className={className}>
      {children}
    </Animated.View>
  );
}

// Placeholder block shaped like the content it stands in for — adapted from
// React Native Reusables' Skeleton (reanimated opacity pulse). Size and shape
// come from className (e.g. "h-4 w-32", "h-10 w-10 rounded-full"); corners
// default to rounded-md unless className sets its own rounded-*. `tone="paper"`
// is dark ink for blocks sitting on a blank paper Card; the default suits the
// wall and the near-black panels.
export function Skeleton({ className = "", tone = "wall" }: { className?: string; tone?: "wall" | "paper" }) {
  const reduceMotion = useReducedMotion();
  usePulse(!reduceMotion);
  const appear = useAppear();

  const animatedStyle = useAnimatedStyle(() => ({ opacity: appear.value * pulse.value }));
  const rounded = className.includes("rounded") ? "" : "rounded-md";
  const fill = tone === "paper" ? "bg-black/20" : "bg-white/10";

  return <Animated.View style={animatedStyle} className={`${fill} ${rounded} ${className}`} />;
}
