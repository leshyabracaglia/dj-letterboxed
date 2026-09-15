import { Stack } from "expo-router";
import { SafeAreaView, ScrollView } from "react-native";

import { AccountSettings } from "../components/AccountSettings";

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <AccountSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
