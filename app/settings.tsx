import { useUser } from "@clerk/expo";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, View } from "react-native";

import {
  Avatar,
  Button,
  FormMessage,
  KeyboardScrollView,
  Page,
  SectionTitle,
  SegmentedTabs,
  Text,
  TextField,
  usePageContentStyle,
} from "@/components/ui";
import { errorMessage } from "@/lib/api/client";
import { useSettings, useUpdateSettings } from "@/lib/api/hooks";
import type { User } from "@/lib/api/types";
import { useCurrentUser, useUpdateProfile } from "@/lib/auth";
import { pickAndUploadAvatar } from "@/lib/avatarUpload";
import { clerkErrorMessage } from "@/lib/clerk";
import { confirmDestructive, showAlert } from "@/lib/dialog";
import { useSignOut } from "@/lib/push";
import { useDesign, useDesignColors } from "@/lib/design";
import { ROUTES } from "@/lib/routes";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

function EditProfile() {
  const { me } = useCurrentUser();
  return me ? <EditProfileForm key={me.id} me={me} /> : null;
}

// Starts from the saved profile, and takes back what the server saved (the
// username lowercased, the bio trimmed) after each save.
function EditProfileForm({ me }: { me: User }) {
  const { user: clerkUser } = useUser();

  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(me.avatarUrl ?? null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    onSuccess: (saved) => {
      setUsername(saved.username);
      setBio(saved.bio ?? "");
      setSuccess(true);
    },
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

// Notifications about activity on your own account (follows, likes,
// comments, tags) are controlled from the phone's settings; the
// re-engagement push is optional on top of those, so it gets its own switch.
function NotificationSettings() {
  const [error, setError] = useState<string | null>(null);

  const settings = useSettings();
  const update = useUpdateSettings();

  const colors = useDesignColors();

  const reengagePush = update.isPending ? !!update.variables.reengagePush : (settings.data?.reengagePush ?? true);

  return (
    <View className="gap-2 border-t border-primary/15 pt-10">
      <SectionTitle>Notifications</SectionTitle>
      <View className="flex-row items-center gap-4">
        <View className="flex-1">
          <Text className="text-base text-paper">While you&apos;re away</Text>
          <Text className="text-sm text-muted">
            A heads-up when people you follow log nights and you haven&apos;t opened Beatboxd in a couple of days.
          </Text>
        </View>
        <Switch
          value={reengagePush}
          onValueChange={(value) => {
            setError(null);
            update.mutate(
              { reengagePush: value },
              { onError: (err) => setError(errorMessage(err, "Could not save that setting.")) },
            );
          }}
          disabled={!settings.data || update.isPending}
          trackColor={{ false: colors.muted, true: colors.primary }}
          accessibilityLabel="Notify me when people I follow log nights while I'm away"
        />
      </View>
      <Text className="text-xs text-muted">
        Follows, likes, comments and tags are on or off in your phone&apos;s notification settings.
      </Text>
      <FormMessage>{error ?? (settings.isError && "Could not load your settings.")}</FormMessage>
    </View>
  );
}

// Which look the app wears on this device: the violet design, or the
// original zine (lib/design.tsx).
function DesignSettings() {
  const { design, setDesign } = useDesign();
  return (
    <View className="gap-3 border-t border-primary/15 pt-10">
      <SectionTitle>Design</SectionTitle>
      <SegmentedTabs
        tabs={[
          { value: "violet", label: "Violet" },
          { value: "zine", label: "Classic zine" },
        ]}
        value={design}
        onChange={setDesign}
      />
      <Text className="text-xs text-muted">Just on this device.</Text>
    </View>
  );
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
      showAlert("Could not delete account", clerkErrorMessage(err, "Please try again."));
      setDeletePending(false);
    }
  };

  const onDeletePress = async () => {
    const confirmed = await confirmDestructive({
      title: "Delete account",
      message: "This permanently deletes your account and all your reviews. This can't be undone.",
    });
    if (confirmed) deleteAccount();
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
        <Pressable onPress={() => router.push(ROUTES.TERMS)}>
          <Text className="text-sm text-primary-dark">Terms</Text>
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
          <NotificationSettings />
          <DesignSettings />
          <AccountSettings />
        </View>
      </KeyboardScrollView>
    </Page>
  );
}
