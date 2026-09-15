import { useAuth, useUser } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { Avatar } from "../../components/Avatar";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { UpdateProfileInput, User } from "../../lib/api/types";
import { pickAndUploadAvatar } from "../../lib/avatarUpload";
import { ROUTES } from "../../lib/routes";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export default function OnboardingScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { user: clerkUser } = useUser();
  const { signOut } = useAuth();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
  });

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const submit = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<User>("/users/me", input),
    onSuccess: (updated) => {
      // Seed the cache synchronously with the response before navigating -
      // (tabs)/_layout's onboarding gate reads this query on mount, and an
      // async invalidateQueries() wouldn't resolve in time, bouncing us
      // straight back here with the stale (still-fallback) username.
      queryClient.setQueryData(queryKeys.users.me(), updated);
      router.replace(ROUTES.FEED);
    },
    onError: (err: any) => {
      setError(
        err?.code === "USERNAME_TAKEN"
          ? "That username is already taken."
          : (err?.message ?? "Could not save your profile."),
      );
    },
  });

  const onSubmit = () => {
    Keyboard.dismiss();
    setError(null);
    if (!usernameValid) {
      setError("Username must be 3-32 characters: lowercase letters, numbers, underscores.");
      return;
    }
    submit.mutate({
      username: displayUsername,
      bio: bio.trim() || undefined,
      avatarUrl: avatarUrl ?? undefined,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-2 text-3xl font-display text-ink dark:text-paper">Set up your profile</Text>
          <Text className="mb-8 text-center text-muted">
            Choose a username so people can find you. A photo is optional.
          </Text>

          <Pressable onPress={onPickPhoto} disabled={uploadingPhoto} className="mb-6">
            <Avatar uri={avatarUrl} name={displayUsername || me?.username || "?"} size={88} />
            <Text className="mt-2 text-center text-sm text-muted">
              {uploadingPhoto ? "Uploading..." : avatarUrl ? "Change photo" : "Add a photo"}
            </Text>
          </Pressable>

          <View className="w-full max-w-sm">
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
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
              placeholder="Bio (optional)"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              blurOnSubmit
              className="mb-4 min-h-20 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
            />

            {error ? <Text className="mb-3 text-danger">{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={submit.isPending || !usernameValid}
              className="w-full rounded-xl bg-primary py-3 active:opacity-90"
            >
              <Text className="text-center font-semibold text-paper">
                {submit.isPending ? "Saving..." : "Continue"}
              </Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                await signOut();
                router.replace(ROUTES.SIGN_IN);
              }}
              className="mt-4"
            >
              <Text className="text-center text-sm text-muted">Not now — sign out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
