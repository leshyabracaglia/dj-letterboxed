import { LinearGradient } from "expo-linear-gradient";
import { cssInterop, useColorScheme } from "nativewind";
import type { ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";

cssInterop(LinearGradient, { className: "style" });

// A smooth fade reads as flat gray at button size — real metal needs a
// sharp specular edge. This mimics a beveled aluminum bar: a bright highlight
// snaps in near the top (where light catches the bevel), drops quickly into
// a mid-tone body, then a dark base — plus an actual top/bottom border bevel
// and a thin purple rim glow so the brand accent still shows on the metal.
const LIGHT_GRADIENT = ["#FBFAFC", "#C7C3D0", "#726D7D", "#3A3742"] as const;
const LIGHT_LOCATIONS = [0, 0.16, 0.62, 1] as const;
const DARK_GRADIENT = ["#D8D4E2", "#948FA3", "#5A5568", "#211E28"] as const;
const DARK_LOCATIONS = [0, 0.16, 0.62, 1] as const;

export function MetalButton({
  className,
  children,
  disabled,
  ...props
}: PressableProps & { className?: string; children?: ReactNode }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? DARK_GRADIENT : LIGHT_GRADIENT;
  const locations = isDark ? DARK_LOCATIONS : LIGHT_LOCATIONS;

  return (
    <Pressable disabled={disabled} {...props}>
      {({ pressed }) => (
        <LinearGradient
          colors={colors}
          locations={locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          className={`border border-accent/50 ${className ?? ""}`}
          style={{
            borderTopColor: "rgba(255,255,255,0.55)",
            borderBottomColor: "rgba(0,0,0,0.4)",
            opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          }}
        >
          {children}
        </LinearGradient>
      )}
    </Pressable>
  );
}
