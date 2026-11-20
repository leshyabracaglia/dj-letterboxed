import { useUser } from "@clerk/expo";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Image, Keyboard, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton, AuthTitle, FieldLabel, LOGO } from "@/components/auth/parts";
import { FormMessage, Icon, KeyboardScrollView, Stamp, Tape, Text, WallView } from "@/components/ui";

import { track } from "@/lib/analytics";
import { unwrap, useApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queryKeys";
import type { UsernameCheck } from "@/lib/api/types";
import { useCurrentUser, useUpdateProfile } from "@/lib/auth";
import { getCurrentPlace } from "@/lib/location";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { pickAndUploadAvatar } from "@/lib/avatarUpload";
import { useSignOut } from "@/lib/push";
import { ROUTES } from "@/lib/routes";
import { needsOnboarding } from "@/lib/user";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export default function OnboardingScreen() {
  const { user: clerkUser } = useUser();
  const signOut = useSignOut();

  const { me } = useCurrentUser();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [locating, setLocating] = useState(false);

  // Fills in the city from where the device is; they can edit it after.
  const onUseLocation = async () => {
    setLocating(true);
    try {
      const place = await getCurrentPlace();
      if (place?.city) setCity(place.city);
      else setError("Couldn't tell your city from your location. Type it in instead.");
    } catch {
      setError("Couldn't get your location. Type your city in instead.");
    } finally {
      setLocating(false);
    }
  };
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayUsername = username.trim().toLowerCase();
  const usernameValid = USERNAME_RE.test(displayUsername);
  const api = useApi();
  // Whether it's free, checked once typing pauses.
  const checking = useDebouncedValue(usernameValid ? displayUsername : "", 400);
  const check = useQuery({
    queryKey: queryKeys.users.usernameCheck(checking),
    queryFn: checking
      ? () => unwrap(api.GET("/api/users/username-check", { params: { query: { username: checking } } }))
      : skipToken,
    staleTime: 30_000,
  });
  const result = check.data?.username === displayUsername ? check.data : undefined;
  const taken = !!result && !result.available;

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
    onSuccess: () => track("onboarding_completed"),
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
      city: city.trim() || undefined,
      avatarUrl: avatarUrl ?? undefined,
    });
  };

  // Leave once the saved username has reached `me`, rather than from the
  // mutation's onSuccess: navigating there raced the cache update, and the
  // tabs' onboarding gate, still seeing the fallback username, sent people
  // straight back here. This also moves on anyone who lands here already set up.
  if (me && !needsOnboarding(me.username)) {
    return <Redirect href={ROUTES.FEED} />;
  }

  return (
    <WallView>
      <SafeAreaView className="flex-1">
        <KeyboardScrollView className="flex-1" contentContainerClassName="flex-grow px-5 pb-7 pt-10">
          <View className="w-full max-w-md flex-grow gap-[18px] self-center">
            <View className="gap-1">
              <FieldLabel className="text-paper/60">Last step</FieldLabel>
              <AuthTitle className="text-[46px] leading-[44px]">Issue your passport</AuthTitle>
              <Text className="text-sm leading-5 text-paper/70">
                Pick a username so friends can find you. Every club you log gets stamped in here.
              </Text>
            </View>

            <View className="bg-zine-panel shadow-2xl shadow-black/50">
              <View className="flex-row items-center justify-between bg-zine-purple px-4 py-3">
                <Text variant="display" className="text-[22px] uppercase text-paper">
                  BeatBox&apos;d passport
                </Text>
                <Image source={LOGO} style={{ width: 30, height: 30 }} accessibilityIgnoresInvertColors />
              </View>
              <View className="flex-row gap-3.5 p-4">
                <PhotoSlot uri={avatarUrl} uploading={uploadingPhoto} onPress={onPickPhoto} />
                <View className="min-w-0 flex-1 gap-3">
                  <View className="gap-1">
                    <FieldLabel className="text-[10px] text-paper/55">Username</FieldLabel>
                    <View className="h-11 flex-row items-center border-b border-paper/40">
                      <Text variant="display" className="text-2xl text-zine-red-ink">
                        @
                      </Text>
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={me?.username ?? "you"}
                        placeholderTextColor="rgba(246,246,249,0.3)"
                        value={username}
                        onChangeText={setUsername}
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        accessibilityLabel="Username"
                        className="min-w-0 flex-1 pl-0.5 font-display text-[26px] text-paper"
                      />
                    </View>
                    <UsernameStatus
                      username={displayUsername}
                      typed={!!username.length}
                      valid={usernameValid}
                      result={result}
                    />
                  </View>
                  <View className="gap-1">
                    <FieldLabel className="text-[10px] text-paper/55">Based in</FieldLabel>
                    <View className="flex-row items-center border-b border-paper/40">
                      <TextInput
                        placeholder="Brooklyn"
                        placeholderTextColor="rgba(246,246,249,0.3)"
                        value={city}
                        onChangeText={setCity}
                        returnKeyType="done"
                        accessibilityLabel="City you're based in"
                        className="min-w-0 flex-1 py-2 text-sm text-paper"
                      />
                      <Pressable
                        onPress={onUseLocation}
                        disabled={locating}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Use my location"
                        className="active:opacity-70"
                      >
                        <Icon
                          name={locating ? "ellipsis-horizontal" : "locate"}
                          size={18}
                          className="text-zine-red-ink"
                        />
                      </Pressable>
                    </View>
                  </View>
                  <View className="gap-1">
                    <FieldLabel className="text-[10px] text-paper/55">Bio · optional</FieldLabel>
                    <TextInput
                      placeholder="Brooklyn / Berlin. Here for the closers."
                      placeholderTextColor="rgba(246,246,249,0.3)"
                      value={bio}
                      onChangeText={setBio}
                      multiline
                      blurOnSubmit
                      accessibilityLabel="Bio"
                      className="min-h-10 border-b border-paper/40 py-2 text-sm text-paper"
                    />
                  </View>
                </View>
              </View>
              <View className="overflow-hidden border-t border-paper/10 px-4 pb-4 pt-2.5">
                {machineLines(displayUsername || me?.username || "").map((line) => (
                  <Text key={line} numberOfLines={1} className="text-[11px] leading-4 tracking-[2px] text-paper/45">
                    {line}
                  </Text>
                ))}
              </View>
              <View className="absolute -bottom-9 -right-2">
                <Stamp
                  label={joinedLabel()}
                  rim="JOINED · BEATBOXD · "
                  size={96}
                  rotate={-12}
                  accessibilityLabel="Joined Beatboxd"
                />
              </View>
            </View>

            <View className="min-h-12 flex-grow" />
            <FormMessage>{error}</FormMessage>
            <AuthButton
              label={submit.isPending ? "Stamping…" : "Stamp it"}
              onPress={onSubmit}
              disabled={submit.isPending || !usernameValid || taken}
            />
            <Pressable
              onPress={async () => {
                await signOut();
                router.replace(ROUTES.SIGN_IN);
              }}
              className="items-center py-1"
            >
              <Text className="text-sm text-paper/60">Not now — sign out</Text>
            </Pressable>
          </View>
        </KeyboardScrollView>
      </SafeAreaView>
    </WallView>
  );
}

// Under the username: the rule while it doesn't fit it, then whether it's
// free once the check comes back.
function UsernameStatus({
  username,
  typed,
  valid,
  result,
}: {
  username: string;
  typed: boolean;
  valid: boolean;
  result?: UsernameCheck;
}) {
  if (!typed) return null;
  if (!valid) {
    return <Text className="text-xs text-danger-dark">3-32 characters: lowercase letters, numbers, underscores.</Text>;
  }
  if (!result) return <Text className="text-xs text-paper/50">Checking…</Text>;
  if (!result.valid) return <Text className="text-xs text-danger-dark">That username isn&apos;t allowed.</Text>;
  if (!result.available) return <Text className="text-xs text-danger-dark">@{username} is taken</Text>;
  return (
    <View className="flex-row items-center gap-1">
      <Icon name="checkmark" size={13} className="text-zine-red-ink" />
      <Text className="text-xs text-zine-red-ink">{username} is free</Text>
    </View>
  );
}

// The passport photo: a dashed, taped-on slot to add one, or the photo
// picked.
function PhotoSlot({ uri, uploading, onPress }: { uri: string | null; uploading: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={uri ? "Change photo" : "Add a photo"}
      className={`h-32 w-[104px] items-center justify-center gap-1.5 bg-[#050405] active:opacity-80 ${
        uri ? "border-4 border-paper" : "border-2 border-dashed border-paper/40"
      }`}
    >
      {uri ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        <>
          <Icon name="camera-outline" size={26} className="text-paper" />
          <FieldLabel className="text-[10px] text-paper">{uploading ? "Uploading…" : "Add photo"}</FieldLabel>
        </>
      )}
      <Tape width={60} rotate={-5} style={{ top: -10, left: 20 }} />
    </Pressable>
  );
}

// The machine-readable strip along a passport's foot: the username, then
// the month joined, padded out with chevrons.
function machineLines(username: string): string[] {
  const pad = (s: string) => (s + "<".repeat(40)).slice(0, 40);
  const now = new Date();
  const joined = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase() + String(now.getFullYear()).slice(2);
  return [pad(`P<BBX<<${username.toUpperCase()}`), pad(`${joined}<<BEATBOXD`)];
}

// "NOV" over "2026" for the joined stamp.
function joinedLabel(): string[] {
  const now = new Date();
  return [now.toLocaleDateString("en-US", { month: "short" }).toUpperCase(), String(now.getFullYear())];
}
