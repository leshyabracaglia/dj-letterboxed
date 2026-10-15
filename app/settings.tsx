import { Stack } from "expo-router";

import { isClerkAPIResponseError, useUser } from "@clerk/expo";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  Avatar,
  Button,
  FormMessage,
  KeyboardScrollView,
  Page,
  SectionTitle,
  Text,
  TextField,
  usePageContentStyle,
} from "../components/ui";
import { useCurrentUser, useUpdateProfile } from "../lib/auth";
import { pickAndUploadAvatar } from "../lib/avatarUpload";
import { useSignOut } from "../lib/push";
import { ROUTES } from "../lib/routes";
import { isWeb } from "@/lib/utils";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

function EditProfile() {
  const { user: clerkUser } = useUser();

  const { me } = useCurrentUser();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(undefined);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
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
    setIsUploadingPhoto(true);
    try {
      const url = await pickAndUploadAvatar(clerkUser);
      if (url) setAvatarUrl(url);
    } catch {
      setError("Could not upload that photo. Try a different one.");
    } finally {
      setIsUploadingPhoto(false);
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
    <View className="gap-3">
      <SectionTitle>Edit profile</SectionTitle>
      <Pressable onPress={onPickPhoto} disabled={isUploadingPhoto} className="items-center">
        <Avatar uri={avatarUrl} name={displayUsername || "?"} size={72} />
        <Text className="mt-2 text-sm text-muted">{isUploadingPhoto ? "Uploading..." : "Change photo"}</Text>
      </Pressable>
      <View>
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
        />
        {!!username.length && !usernameValid && (
          <Text className="mt-1 text-xs text-danger-dark">
            3-32 characters: lowercase letters, numbers, underscores.
          </Text>
        )}
      </View>
      <TextField placeholder="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={3} className="min-h-20" />
      <FormMessage>{error}</FormMessage>
      <FormMessage tone="success">{success && "Profile updated."}</FormMessage>
      <Button disabled={save.isPending || !usernameValid} onPress={onSave} className="mt-1 py-3">
        <Text className="text-center font-semibold text-paper">{save.isPending ? "Saving..." : "Save profile"}</Text>
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
  const signOut = useSignOut();
  // Accounts created via a social provider have no password yet, so there's
  // no current one to confirm — Clerk lets them set one directly.
  const hasPassword = user?.passwordEnabled ?? true;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (hasPassword && !currentPassword) {
      setPasswordError("Enter your current password");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    setPasswordPending(true);
    try {
      await user?.updatePassword({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
        signOutOfOtherSessions: true,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
    } catch (err) {
      setPasswordError(clerkErrorMessage(err, "Could not update your password"));
    } finally {
      setPasswordPending(false);
    }
  };

  // Resetting goes through Clerk's sign-in flow, which needs a signed-out
  // client, so sign out first and hand the email over to prefill the form.
  const onForgotPassword = async () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    await signOut();
    router.replace(ROUTES.FORGOT_PASSWORD(email ? { email } : undefined));
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
    if (isWeb) {
      if (window.confirm("Delete your account? This can't be undone.")) {
        deleteAccount();
      }
      return;
    }
    Alert.alert("Delete account", "This permanently deletes your account and all your reviews. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: deleteAccount },
    ]);
  };

  return (
    <View className="gap-2 border-t border-primary/15 pt-10">
      <SectionTitle>{hasPassword ? "Change password" : "Set a password"}</SectionTitle>
      {hasPassword && (
        <TextField
          secureTextEntry
          autoComplete="current-password"
          placeholder="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
      )}
      <TextField
        secureTextEntry
        autoComplete="new-password"
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TextField
        secureTextEntry
        autoComplete="new-password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      <FormMessage>{passwordError}</FormMessage>
      <FormMessage tone="success">
        {passwordSuccess && "Password updated. Other devices have been signed out."}
      </FormMessage>
      <Button disabled={passwordPending} onPress={onChangePassword} className="py-3">
        <Text className="text-center font-semibold text-paper">
          {passwordPending ? "Saving..." : hasPassword ? "Update password" : "Set password"}
        </Text>
      </Button>
      {hasPassword && (
        <Pressable onPress={onForgotPassword} className="mt-1 self-center">
          <Text className="text-sm text-primary-dark">Forgot your current password?</Text>
        </Pressable>
      )}

      <Pressable
        onPress={async () => {
          await signOut();
          router.replace(ROUTES.SIGN_IN);
        }}
        className="mt-6 rounded-xl border border-primary/30 py-3 active:opacity-80"
      >
        <Text className="text-center font-semibold text-paper">Sign out</Text>
      </Pressable>

      <View className="mt-4 flex-row justify-center gap-6">
        <Pressable onPress={() => router.push(ROUTES.SUPPORT)}>
          <Text className="text-sm text-primary-dark">Help & support</Text>
        </Pressable>
        <Pressable onPress={() => router.push(ROUTES.PRIVACY)}>
          <Text className="text-sm text-primary-dark">Privacy policy</Text>
        </Pressable>
      </View>

      <Text className="mt-6 text-xl font-display text-danger-dark">Danger zone</Text>
      <Pressable
        disabled={deletePending}
        onPress={onDeletePress}
        className="rounded-xl border py-3 active:opacity-80 border-danger-dark"
      >
        <Text className="text-center font-semibold text-danger-dark">
          {deletePending ? "Deleting..." : "Delete account"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const contentStyle = usePageContentStyle("roomy");

  return (
    <Page fullBleed>
      <Stack.Screen options={{ title: "Settings" }} />
      <KeyboardScrollView contentContainerStyle={contentStyle}>
        <View className="mt-6 gap-6">
          <EditProfile />
          <AccountSettings />
        </View>
      </KeyboardScrollView>
    </Page>
  );
}
