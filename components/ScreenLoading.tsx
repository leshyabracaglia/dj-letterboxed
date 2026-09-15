import { SafeAreaView, Text } from "react-native";

export function ScreenLoading() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-paper">
      <Text className="text-muted">Loading...</Text>
    </SafeAreaView>
  );
}
