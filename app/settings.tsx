import { Stack } from "expo-router";
import { ScrollView } from "react-native";

import { isClerkAPIResponseError, useUser } from "@clerk/expo";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, TextInput, View } from "react-native";

import { Avatar, Button, Page, Text, usePageContentStyle } from "../components/ui";
import { useCurrentUser, useUpdateProfile } from "../lib/auth";
import { pickAndUploadAvatar } from "../lib/avatarUpload";
import { ROUTES } from "../lib/routes";
import {
  getStoredThemePreference,
  resolveColorScheme,
  setStoredThemePreference,
  type ThemePreference,
} from "../lib/theme-storage";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearanceSettings() {
  const { setColorScheme } = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    getStoredThemePreference().then((pref) => {
      if (pref) setPreference(pref);
    });
  }, []);

  const choose = (value: ThemePreference) => {
    setPreference(value);
    setColorScheme(resolveColorScheme(value));
    setStoredThemePreference(value);
  };

  return (
    <View className="mt-6 border-t border-primary/15 pt-4">
      <Text className="mb-2 text-xl font-display text-ink dark:text-paper">Appearance</Text>
      <View className="flex-row gap-2">
        {THEME_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => choose(opt.value)}
            className={`flex-1 items-center rounded-xl border py-2 ${
              preference === opt.value ? "border-primary bg-primary" : "border-primary/20"
            }`}
          >
            <Text
              className={
                preference === opt.value
                  ? "font-semibold text-paper"
                  : "text-ink dark:text-paper"
              }
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

function EditProfile() {
  const { user: clerkUser } = useUser();

  const { me } = useCurrentUser();

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

  const save = useUpdateProfile({
    onSuccess: () => setSuccess(true),
    onError: setError,
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
      <Text className="mb-4 text-xl font-display text-ink dark:text-paper">Edit profile</Text>
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
        placeholder="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        className="mb-4 min-h-20 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
      />
      {error ? <Text className="mb-2 text-danger dark:text-danger-dark">{error}</Text> : null}
      {success ? (
        <Text className="mb-2 text-success dark:text-success-dark">Profile updated.</Text>
      ) : null}
      <Button
        disabled={save.isPending || !usernameValid}
        onPress={onSave}
        className="py-3"
      >
        <Text className="text-center font-semibold text-paper">
          {save.isPending ? "Saving..." : "Save profile"}
        </Text>
      </Button>
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
      "This permanently deletes your account and all your reviews. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteAccount },
      ],
    );
  };

  return (
    <View className="mt-6 border-t border-primary/15 pt-4">
      <Text className="mb-2 text-xl font-display text-ink dark:text-paper">Change password</Text>
      <TextInput
        secureTextEntry
        placeholder="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        className="mb-2 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
      />
      <TextInput
        secureTextEntry
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        className="mb-2 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
      />
      {passwordError ? (
        <Text className="mb-2 text-danger dark:text-danger-dark">{passwordError}</Text>
      ) : null}
      {passwordSuccess ? (
        <Text className="mb-2 text-success dark:text-success-dark">Password updated.</Text>
      ) : null}
      <Button
        disabled={passwordPending}
        onPress={onChangePassword}
        className="py-3"
      >
        <Text className="text-center font-semibold text-paper">
          {passwordPending ? "Saving..." : "Update password"}
        </Text>
      </Button>

      <Text className="mb-2 mt-8 text-xl font-display text-danger dark:text-danger-dark">
        Danger zone
      </Text>
      <Pressable
        disabled={deletePending}
        onPress={onDeletePress}
        className="rounded-xl border border-danger py-3 active:opacity-80 dark:border-danger-dark"
      >
        <Text className="text-center font-semibold text-danger dark:text-danger-dark">
          {deletePending ? "Deleting..." : "Delete account"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView contentContainerStyle={[contentStyle, { paddingTop: 24 }]}>
        <EditProfile />
        <AppearanceSettings />
        <AccountSettings />
      </ScrollView>
    </Page>
  );
}
