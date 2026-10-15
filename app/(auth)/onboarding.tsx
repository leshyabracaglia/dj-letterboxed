import { useUser } from "@clerk/expo";
import { router } from "expo-router";
import { useState } from "react";
import { Keyboard, Pressable, View } from "react-native";

import { AuthScreen } from "../../components/AuthScreen";
import { Avatar, Button, FormMessage, Text, TextField } from "../../components/ui";

import { useCurrentUser, useUpdateProfile } from "../../lib/auth";
import { pickAndUploadAvatar } from "../../lib/avatarUpload";
import { useSignOut } from "../../lib/push";
import { ROUTES } from "../../lib/routes";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export default function OnboardingScreen() {
  const { user: clerkUser } = useUser();
  const signOut = useSignOut();

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

  const submit = useUpdateProfile({
    onSuccess: () => router.dismissTo(ROUTES.FEED),
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
    <AuthScreen title="Set up your profile" subtitle="Choose a username so people can find you. A photo is optional.">
      <Pressable onPress={onPickPhoto} disabled={uploadingPhoto}>
        <Avatar uri={avatarUrl} name={displayUsername || me?.username || "?"} size={88} />
        <Text className="mt-2 text-center text-sm text-muted">
          {uploadingPhoto ? "Uploading..." : avatarUrl ? "Change photo" : "Add a photo"}
        </Text>
      </Pressable>

      <View className="mt-3 w-full gap-3">
        <View>
          <TextField
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {!!username.length && !usernameValid && (
            <Text className="mt-1 text-xs text-danger-dark">
              3-32 characters: lowercase letters, numbers, underscores.
            </Text>
          )}
        </View>

        <TextField
          placeholder="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          blurOnSubmit
          className="min-h-20"
        />

        <FormMessage>{error}</FormMessage>

        <Button onPress={onSubmit} disabled={submit.isPending || !usernameValid} className="w-full py-3">
          <Text className="text-center font-semibold text-paper">{submit.isPending ? "Saving..." : "Continue"}</Text>
        </Button>

        <Pressable
          onPress={async () => {
            await signOut();
            router.replace(ROUTES.SIGN_IN);
          }}
          className="mt-1"
        >
          <Text className="text-center text-sm text-muted">Not now — sign out</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
