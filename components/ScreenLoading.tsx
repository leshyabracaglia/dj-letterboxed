import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./Text";

export function ScreenLoading() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-paper dark:bg-ink">
      <Text className="text-muted">Loading...</Text>
    </SafeAreaView>
  );
}
