import { Link } from "expo-router";
import { useState, type ReactNode } from "react";
import { Image, Modal, Pressable, useWindowDimensions, View } from "react-native";

import { useUserStats } from "@/lib/api/hooks";
import { colors } from "@/lib/colors";
import { pluralWord } from "@/lib/format";
import type { User, UserProfile } from "@/lib/api/types";
import { ROUTES } from "@/lib/routes";
import { StatsSummary } from "./StatsSummary";
import { ChannelLabel, FadeInView, FitText, Icon, Skeleton, Text } from "./ui";

const PHOTO_SIZE = 88;

/** Top of a profile: their photo, and beside it their handle on violet,
 * where they're based and when they joined, and followers and following;
 * then their bio, the night/DJ/club counts and their stats. `action` sits top-right (settings key on your own
 * profile, follow button on someone else's). */
export function ProfileHeader({
  user,
  profile,
  action,
  channel,
}: {
  user: User | null | undefined;
  profile: UserProfile | undefined;
  action?: ReactNode;
  channel?: string;
}) {
  const [showAvatarFullScreen, setShowAvatarFullScreen] = useState(false);
  const joined =
    user && new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }).toUpperCase();

  return (
    <View>
      {(!!channel || !!action) && (
        <View className="flex-row items-center justify-between">
          {channel ? <ChannelLabel label={channel} /> : <View />}
          {action}
        </View>
      )}
      <View className={`${channel || action ? "mt-3" : ""} flex-row items-center gap-4`}>
        {user ? (
          <FadeInView className="flex-1 flex-row items-center gap-4">
            <Pressable
              onPress={() => setShowAvatarFullScreen(true)}
              disabled={!user.avatarUrl}
              accessibilityRole="imagebutton"
              accessibilityLabel={`View @${user.username}'s profile picture`}
              className="border-4 border-paper bg-zine-panel shadow-lg shadow-black/50"
            >
              {user.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
                  resizeMode="cover"
                />
              ) : (
                <View className="items-center justify-center" style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}>
                  <Text variant="display" className="text-5xl uppercase text-paper/70">
                    {user.username.slice(0, 1)}
                  </Text>
                </View>
              )}
            </Pressable>
            <View className="flex-1 items-start gap-1.5">
              <View className="max-w-full bg-zine-purple px-2.5 py-1">
                <FitText fontSize={36} numberOfLines={1} className="uppercase text-paper">
                  {`@${user.username}`}
                </FitText>
              </View>
              <Text className="text-xs uppercase tracking-widest text-paper/70">
                {[user.city, `Joined ${joined}`].filter(Boolean).join(" · ")}
              </Text>
              <FollowCounts profile={profile} />
            </View>
          </FadeInView>
        ) : (
          <>
            <Skeleton className="h-[96px] w-[96px]" />
            <View className="gap-2">
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-4 w-36" />
            </View>
          </>
        )}
      </View>
      {!!user?.bio && <Text className="mt-3 text-base text-paper">{user.bio}</Text>}
      <View className="mt-4" />
      <ProfileCounts profile={profile} />
      {!!user?.username && (
        <View className="mt-3">
          <StatsSummary username={user.username} />
        </View>
      )}
      {!!user?.avatarUrl && (
        <AvatarViewer
          uri={user.avatarUrl}
          visible={showAvatarFullScreen}
          onClose={() => setShowAvatarFullScreen(false)}
        />
      )}
    </View>
  );
}

// The profile picture blown up over a dimmed screen; tap anywhere to close.
function AvatarViewer({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height - 160, 480);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        className="flex-1 items-center justify-center bg-black/90"
      >
        <View className="absolute right-5 top-14">
          <Icon name="close" size={28} className="text-paper" />
        </View>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderWidth: 4, borderColor: colors.paper }}
          resizeMode="cover"
        />
      </Pressable>
    </Modal>
  );
}

// One of the big counts across the top: the number over its label.
function Stat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <View className="flex-1 items-center">
      {value === undefined ? (
        <Skeleton className="h-8 w-10" />
      ) : (
        <Text className="font-numeric text-[34px] leading-9 text-paper">{value}</Text>
      )}
      <Text className="text-[11px] uppercase tracking-widest text-paper/60">{label}</Text>
    </View>
  );
}

// Followers and following, each linking to the list.
function FollowCounts({ profile }: { profile: UserProfile | undefined }) {
  if (!profile) return <Skeleton className="h-4 w-40" />;
  return (
    <View className="flex-row flex-wrap items-center gap-x-4">
      <Link href={ROUTES.USER_FOLLOWERS(profile.user.username)}>
        <Text className="text-sm text-paper/70">
          <Text className="font-bold text-sm text-paper">{profile.followerCount}</Text>{" "}
          {pluralWord(profile.followerCount, "follower")}
        </Text>
      </Link>
      <Link href={ROUTES.USER_FOLLOWING(profile.user.username)}>
        <Text className="text-sm text-paper/70">
          <Text className="font-bold text-sm text-paper">{profile.followingCount}</Text> following
        </Text>
      </Link>
    </View>
  );
}

// Nights, DJs and clubs under a hairline.
function ProfileCounts({ profile }: { profile: UserProfile | undefined }) {
  const { data: userStats } = useUserStats(profile?.user.username);
  const nights = profile?.reviewCount;
  const djs = userStats?.uniqueDjs;
  const clubs = userStats?.passport.length;

  return (
    <View className="flex-row border-t border-paper/15 py-3">
      <Stat value={nights} label={pluralWord(nights ?? 0, "night")} />
      <Stat value={djs} label={djs === 1 ? "DJ" : "DJs"} />
      <Stat value={clubs} label={pluralWord(clubs ?? 0, "club")} />
    </View>
  );
}
