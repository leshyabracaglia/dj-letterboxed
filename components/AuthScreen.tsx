import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandWordmark } from "./BrandWordmark";
import { KeyboardScrollView, Text, WallView } from "./ui";

/** The layout every sign-in/sign-up step shares: centered on the wall, the
 * wordmark (when `wordmark`), a big title and an optional line under it, then
 * the form (`children`) in a phone-width column, spaced gap-3. */
export function AuthScreen({
  title,
  subtitle,
  wordmark = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  wordmark?: boolean;
  children: ReactNode;
}) {
  return (
    <WallView>
      <SafeAreaView className="flex-1">
        <KeyboardScrollView className="flex-1" contentContainerClassName="flex-grow items-center justify-center p-6">
          {wordmark && <BrandWordmark />}
          <Text
            className={`${wordmark ? "mt-6" : ""} text-center font-display text-5xl uppercase leading-[48px] text-paper`}
          >
            {title}
          </Text>
          {!!subtitle && <Text className="mt-2 text-center text-muted">{subtitle}</Text>}
          <View className="mt-8 w-full max-w-sm items-center gap-3">{children}</View>
        </KeyboardScrollView>
      </SafeAreaView>
    </WallView>
  );
}
