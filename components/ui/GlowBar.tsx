import { View } from "react-native";

// A centered bloom (no offset), so the light spreads evenly around the bar
// rather than hanging below it. `boxShadow` blurs and colors the same way on
// iOS, Android (new architecture) and web.
const GLOW = "0 0 6px 1px rgba(246,246,249,0.75), 0 0 14px 2px rgba(246,246,249,0.25)";

/** The short bar over a nav item: glowing white when it's the current one,
 * a dim red stub otherwise. */
export function GlowBar({ active, className = "" }: { active: boolean; className?: string }) {
  if (!active) return <View className={`h-[3px] w-7 rounded-full bg-zine-red/40 ${className}`} />;
  return <View className={`h-[3px] w-7 rounded-full bg-paper ${className}`} style={{ boxShadow: GLOW }} />;
}
