import { useState, type ReactNode } from "react";
import { Image, Pressable, TextInput, type TextInputProps, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon, KeyboardScrollView, Stamp, Tape, Text, TornEdge, CARD_COLORS, WallView } from "@/components/ui";

const PLACEHOLDER_COLOR = "rgba(246,246,249,0.4)";
export const LOGO = require("@/assets/logo-mark.png");

/** The small spaced-out caps over a field ("EMAIL", "PASSWORD"). */
export function FieldLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Text className={`text-[11px] uppercase tracking-widest ${className}`}>{children}</Text>;
}

/** A labelled input. `solid` is a plain near-black well (on violet paper);
 * `outlined` adds a faint border (on a dark panel). `aside` sits at the
 * label's right (a "Forgot?" link). A password field (`secureTextEntry`)
 * gets an eye button that shows what's been typed. */
export function AuthField({
  label,
  aside,
  variant = "solid",
  labelClassName = "text-paper/60",
  secureTextEntry,
  ...props
}: TextInputProps & {
  label: string;
  aside?: ReactNode;
  variant?: "solid" | "outlined";
  labelClassName?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <FieldLabel className={labelClassName}>{label}</FieldLabel>
        {aside}
      </View>
      <View
        className={`h-[46px] flex-row items-center ${
          variant === "solid"
            ? "bg-zine-panel"
            : `border bg-[#050405] ${focused ? "border-paper/60" : "border-paper/20"}`
        }`}
      >
        <TextInput
          placeholderTextColor={PLACEHOLDER_COLOR}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          secureTextEntry={secureTextEntry && !revealed}
          className="h-full flex-1 px-3 text-[16px] text-paper"
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={8}
            className="h-full justify-center px-3 active:opacity-60"
          >
            <Icon name={revealed ? "eye-off-outline" : "eye-outline"} size={20} className="text-paper/60" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The one big white key on an auth screen ("SIGN IN", "STAMP IT"). */
export function AuthButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`h-[50px] items-center justify-center bg-paper active:opacity-80 ${disabled ? "opacity-60" : ""}`}
      style={{ boxShadow: "0 0 16px 1px rgba(246,246,249,0.35)" }}
    >
      <Text variant="display" className="text-2xl uppercase text-ink">
        {label}
      </Text>
    </Pressable>
  );
}

// The sign-in wall's photos, laid out for a 390-wide screen and scaled to
// the real one: left, top, width, height, tilt, and whether it's a polaroid
// (a deeper white strip along the bottom).
const COLLAGE = [
  { source: require("@/assets/auth/night-1.jpg"), x: 16, y: 24, w: 150, h: 150, tilt: -6, tape: { x: 30, tilt: -10 } },
  {
    source: require("@/assets/auth/night-2.jpg"),
    x: 214,
    y: 14,
    w: 142,
    h: 170,
    tilt: 5,
    polaroid: true,
    tape: { x: 38, tilt: 4 },
  },
  { source: require("@/assets/auth/night-3.jpg"), x: 112, y: 170, w: 130, h: 110, tilt: 2 },
  { source: require("@/assets/auth/night-4.jpg"), x: 270, y: 212, w: 96, h: 96, tilt: -4 },
];
const COLLAGE_HEIGHT = 330;

/** Nights stuck up on the wall, with today's stamp among them. */
function NightsCollage() {
  const { width } = useWindowDimensions();
  const scale = Math.min(width, 480) / 390;
  const now = new Date();
  const month = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(now.getDate()).padStart(2, "0");
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 390 * scale, height: COLLAGE_HEIGHT * scale, alignSelf: "center" }}
    >
      {COLLAGE.map((photo, i) => (
        <View
          key={i}
          className="absolute border-paper bg-zine-panel shadow-lg shadow-black/50"
          style={{
            left: photo.x * scale,
            top: photo.y * scale,
            width: photo.w * scale,
            height: photo.h * scale,
            borderWidth: 5,
            borderBottomWidth: photo.polaroid ? 26 : 5,
            transform: [{ rotate: `${photo.tilt}deg` }],
          }}
        >
          <Image source={photo.source} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
          {photo.tape && (
            <Tape
              width={68 * scale}
              rotate={photo.tape.tilt - photo.tilt}
              style={{ top: -14, left: photo.tape.x * scale }}
            />
          )}
        </View>
      ))}
      <View className="absolute" style={{ left: 24 * scale, top: 200 * scale }}>
        <Stamp label={[month, day]} rim="LOGGED · BEATBOXD · " size={84 * scale} rotate={-10} accessibilityLabel="" />
      </View>
    </View>
  );
}

/** Sign in's screen: nights stuck up on the wall, and the form on a sheet of
 * violet paper torn along its top, filling the rest of the screen. */
export function WallPanelScreen({ children }: { children: ReactNode }) {
  return (
    <WallView>
      <SafeAreaView edges={["top"]} className="flex-1">
        <KeyboardScrollView className="flex-1" contentContainerClassName="flex-grow">
          <View className="pt-4" />
          <NightsCollage />
          <View className="flex-grow bg-zine-purple px-6 pb-10 pt-6">
            <TornEdge color={CARD_COLORS.primary} side="top" height={10} />
            <View className="w-full max-w-md gap-3 self-center">{children}</View>
          </View>
        </KeyboardScrollView>
      </SafeAreaView>
    </WallView>
  );
}

/** The logo and the wordmark, small, at the top of a form. */
export function AuthBrand() {
  return (
    <View className="flex-row items-center gap-2.5">
      <Image source={LOGO} style={{ width: 36, height: 36 }} accessibilityIgnoresInvertColors />
      <Text variant="display" className="text-[30px] leading-[32px] text-paper">
        BeatBox&apos;d
      </Text>
    </View>
  );
}

/** A big shouted heading ("WELCOME BACK"). */
export function AuthTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Text variant="display" accessibilityRole="header" className={`uppercase text-paper ${className}`}>
      {children}
    </Text>
  );
}
