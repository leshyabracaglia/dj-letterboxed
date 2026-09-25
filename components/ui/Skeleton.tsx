import { cssInterop } from "nativewind";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

cssInterop(Animated.View, { className: "style" });

const PULSE_MS = 1000;

// Placeholder block shaped like the content it stands in for — adapted from
// React Native Reusables' Skeleton (reanimated opacity pulse). Size and shape
// come from className (e.g. "h-4 w-32", "h-10 w-10 rounded-full"); corners
// default to rounded-md unless className sets its own rounded-*.
export function Skeleton({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(
      withSequence(withTiming(0.5, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })),
      -1,
    );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const rounded = className.includes("rounded") ? "" : "rounded-md";

  return (
    <Animated.View
      style={animatedStyle}
      className={`bg-primary/15 dark:bg-white/10 ${rounded} ${className}`}
    />
  );
}
