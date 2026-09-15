import { Stack } from "expo-router";
import { SafeAreaView, ScrollView } from "react-native";

import { isClerkAPIResponseError, useUser } from "@clerk/expo";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";

import { ROUTES } from "../lib/routes";

function clerkErrorMessage(err: unknown, fallback: string) {
  if (isClerkAPIResponseError(err)) {
    return err.errors[0]?.longMessage ?? err.errors[0]?.message ?? fallback;
  }
  return fallback;
}

function AccountSettings() {
  const { user } = useUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const onChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!newPassword) {
      setPasswordError("Enter a new password");
      return;
    }
    setPasswordPending(true);
    try {
      await user?.updatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(clerkErrorMessage(err, "Could not update your password"));
    } finally {
      setPasswordPending(false);
    }
  };

  const deleteAccount = async () => {
    setDeletePending(true);
    try {
      await user?.delete();
      router.replace(ROUTES.SIGN_IN);
    } catch (err) {
      Alert.alert("Could not delete account", clerkErrorMessage(err, "Please try again."));
      setDeletePending(false);
    }
  };

  const onDeletePress = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Delete your account? This can't be undone.")) {
        deleteAccount();
      }
      return;
    }
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all your logs. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteAccount },
      ],
    );
  };

  return (
    <View className="mt-6 border-t border-muted/20 pt-4">
      <Text className="mb-2 text-lg font-semibold text-ink">Change password</Text>
      <TextInput
        secureTextEntry
        placeholder="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        className="mb-2 rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      <TextInput
        secureTextEntry
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        className="mb-2 rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      {passwordError ? <Text className="mb-2 text-accent">{passwordError}</Text> : null}
      {passwordSuccess ? (
        <Text className="mb-2 text-emerald-700">Password updated.</Text>
      ) : null}
      <Pressable
        disabled={passwordPending}
        onPress={onChangePassword}
        className="rounded-lg bg-ink py-3"
      >
        <Text className="text-center font-semibold text-paper">
          {passwordPending ? "Saving..." : "Update password"}
        </Text>
      </Pressable>

      <Text className="mb-2 mt-8 text-lg font-semibold text-ink">Danger zone</Text>
      <Pressable
        disabled={deletePending}
        onPress={onDeletePress}
        className="rounded-lg border border-accent py-3"
      >
        <Text className="text-center font-semibold text-accent">
          {deletePending ? "Deleting..." : "Delete account"}
        </Text>
      </Pressable>
    </View>
  );
}

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
