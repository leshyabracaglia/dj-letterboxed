import { Stack } from "expo-router";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isClerkAPIResponseError, useUser } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, TextInput, View } from "react-native";

import { Avatar } from "../components/Avatar";
import { Text } from "../components/Text";
import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { UpdateProfileInput, User } from "../lib/api/types";
import { pickAndUploadAvatar } from "../lib/avatarUpload";
import { ROUTES } from "../lib/routes";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

function EditProfile() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { user: clerkUser } = useUser();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
  });

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!me) return;
    setUsername(me.username);
    setBio(me.bio ?? "");
    setAvatarUrl(me.avatarUrl ?? null);
  }, [me]);

  const displayUsername = username.trim().toLowerCase();
  const usernameValid = USERNAME_RE.test(displayUsername);

  const onPickPhoto = async () => {
    if (!clerkUser) return;
    setError(null);
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadAvatar(clerkUser);
      if (url) setAvatarUrl(url);
    } catch {
      setError("Could not upload that photo. Try a different one.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<User>("/users/me", input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.users.me(), updated);
      setSuccess(true);
    },
    onError: (err: any) => {
      setError(
        err?.code === "USERNAME_TAKEN"
          ? "That username is already taken."
          : (err?.message ?? "Could not save your profile."),
      );
    },
  });

  const onSave = () => {
    setError(null);
    setSuccess(false);
    if (!usernameValid) {
      setError("Username must be 3-32 characters: lowercase letters, numbers, underscores.");
      return;
    }
    save.mutate({
      username: displayUsername,
      bio: bio.trim(),
      avatarUrl: avatarUrl ?? undefined,
    });
  };

  return (
    <View>
      <Text className="mb-4 text-lg font-display text-ink dark:text-paper">Edit profile</Text>
      <Pressable onPress={onPickPhoto} disabled={uploadingPhoto} className="mb-4 items-center">
        <Avatar uri={avatarUrl} name={displayUsername || "?"} size={72} />
        <Text className="mt-2 text-sm text-muted">
          {uploadingPhoto ? "Uploading..." : "Change photo"}
        </Text>
      </Pressable>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        className="mb-1 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
      />
      {username.length > 0 && !usernameValid ? (
        <Text className="mb-3 text-xs text-danger">
          3-32 characters: lowercase letters, numbers, underscores.
        </Text>
      ) : (
        <View className="mb-3" />
      )}
      <TextInput
        placeholder="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        className="mb-4 min-h-20 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
      />
      {error ? <Text className="mb-2 text-danger">{error}</Text> : null}
      {success ? <Text className="mb-2 text-emerald-700">Profile updated.</Text> : null}
      <Pressable
        disabled={save.isPending || !usernameValid}
        onPress={onSave}
        className="rounded-xl bg-primary py-3 active:opacity-90"
      >
        <Text className="text-center font-semibold text-paper">
          {save.isPending ? "Saving..." : "Save profile"}
        </Text>
      </Pressable>
    </View>
  );
}

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
    <View className="mt-6 border-t border-primary/15 pt-4">
      <Text className="mb-2 text-lg font-display text-ink dark:text-paper">Change password</Text>
      <TextInput
        secureTextEntry
        placeholder="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        className="mb-2 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
      />
      <TextInput
        secureTextEntry
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        className="mb-2 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
      />
      {passwordError ? <Text className="mb-2 text-danger">{passwordError}</Text> : null}
      {passwordSuccess ? (
        <Text className="mb-2 text-emerald-700">Password updated.</Text>
      ) : null}
      <Pressable
        disabled={passwordPending}
        onPress={onChangePassword}
        className="rounded-xl bg-primary py-3 active:opacity-90"
      >
        <Text className="text-center font-semibold text-paper">
          {passwordPending ? "Saving..." : "Update password"}
        </Text>
      </Pressable>

      <Text className="mb-2 mt-8 text-lg font-display text-danger">Danger zone</Text>
      <Pressable
        disabled={deletePending}
        onPress={onDeletePress}
        className="rounded-xl border border-danger py-3 active:opacity-80"
      >
        <Text className="text-center font-semibold text-danger">
          {deletePending ? "Deleting..." : "Delete account"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <EditProfile />
        <AccountSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
