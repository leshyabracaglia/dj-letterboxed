import { useAuth, useUser } from "@clerk/expo";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


import { Avatar, Button, Text } from "../../components/ui";

import { useCurrentUser, useUpdateProfile } from "../../lib/auth";
import { pickAndUploadAvatar } from "../../lib/avatarUpload";
import { ROUTES } from "../../lib/routes";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export default function OnboardingScreen() {
  const { user: clerkUser } = useUser();
  const { signOut } = useAuth();

  const { me } = useCurrentUser();

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

  // useUpdateProfile seeds the current-user cache before this onSuccess runs,
  // so the tabs layout's onboarding gate sees the new username immediately.
  const submit = useUpdateProfile({
    onSuccess: () => router.replace(ROUTES.FEED),
    onError: setError,
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
          <Text className="mb-2 text-4xl font-display text-ink dark:text-paper">Set up your profile</Text>
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
              className="mb-1 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
            />
            {username.length > 0 && !usernameValid ? (
              <Text className="mb-3 text-xs text-danger dark:text-danger-dark">
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
              className="mb-4 min-h-20 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
            />

            {error ? <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text> : null}

            <Button
              onPress={onSubmit}
              disabled={submit.isPending || !usernameValid}
              className="w-full py-3"
            >
              <Text className="text-center font-semibold text-paper">
                {submit.isPending ? "Saving..." : "Continue"}
              </Text>
            </Button>

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
