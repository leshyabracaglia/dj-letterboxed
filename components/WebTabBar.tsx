import { useAuth } from "@clerk/expo";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Text";

import { ROUTES } from "../lib/routes";
import { BrandWordmark } from "./BrandWordmark";
import { MetalButton } from "./MetalButton";
import { SignInPromptModal } from "./SignInPromptModal";

const ACTIVE_COLOR_LIGHT = "#7131B9";
const ACTIVE_COLOR_DARK = "#BA95E4";
const INACTIVE_COLOR = "#8a8a99";

export function WebTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isSignedIn } = useAuth();
  const { colorScheme } = useColorScheme();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const activeColor = colorScheme === "dark" ? ACTIVE_COLOR_DARK : ACTIVE_COLOR_LIGHT;

  return (
    <View className="flex-row items-center justify-between border-b border-ink/10 px-6 py-3 dark:border-paper/10">
      <BrandWordmark />

      <View className="flex-row items-center gap-1">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;
          const color = isFocused ? activeColor : INACTIVE_COLOR;
          // Signed out, Browse and Feed work from the tab bar (Feed falls
          // back to Popular) — Log and Profile pop a sign-in/sign-up prompt
          // instead of navigating into a tab that would just redirect anyway.
          const gated = !isSignedIn && route.name !== "browse" && route.name !== "feed";

          const onPress = () => {
            if (gated) {
              setShowSignInPrompt(true);
              return;
            }

            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${
                isFocused ? "bg-accent-tint dark:bg-accent/15" : ""
              }`}
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 18 })}
              <Text
                className={
                  isFocused ? "font-semibold text-accent-text dark:text-accent-dark" : "text-muted"
                }
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
        {!isSignedIn ? (
          <View className="ml-2 flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push(ROUTES.SIGN_IN)}
              className="rounded-full border border-primary/30 px-4 py-1.5 active:opacity-80"
            >
              <Text className="font-semibold text-ink dark:text-paper">Log in</Text>
            </Pressable>
            <MetalButton
              onPress={() => router.push(ROUTES.SIGN_UP)}
              className="rounded-full px-4 py-1.5"
            >
              <Text className="font-semibold text-paper">Sign up</Text>
            </MetalButton>
          </View>
        ) : null}
      </View>
      <SignInPromptModal visible={showSignInPrompt} onClose={() => setShowSignInPrompt(false)} />
    </View>
  );
}
