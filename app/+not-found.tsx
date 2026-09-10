import { Link, Stack } from "expo-router";
import { SafeAreaView, Text } from "react-native";

import { ROUTES } from "../lib/routes";

export default function NotFoundScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-paper px-6">
      <Stack.Screen options={{ title: "Not found" }} />
      <Text className="mb-3 text-xl font-semibold text-ink">This page doesn't exist.</Text>
      <Link href={ROUTES.HOME}>
        <Text className="text-accent">Go back home</Text>
      </Link>
    </SafeAreaView>
  );
}
