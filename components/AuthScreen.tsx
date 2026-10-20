import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandWordmark } from "./BrandWordmark";
import { KeyboardScrollView, Text, WallView } from "./ui";

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
            variant="display"
            className={`${wordmark ? "mt-6" : ""} text-center text-5xl leading-[48px] text-paper`}
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
