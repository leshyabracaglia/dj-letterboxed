import { Link } from "expo-router";
import { useState, type ReactNode } from "react";
import { Image, Modal, Pressable, useWindowDimensions, View } from "react-native";

import { useUserStats } from "../lib/api/hooks";
import { pluralWord } from "../lib/format";
import type { User, UserProfile } from "../lib/api/types";
import { ROUTES } from "../lib/routes";
import { StatsSummary } from "./StatsSummary";
import { Avatar, ChannelLabel, FadeInView, FitText, Icon, Skeleton, Text } from "./ui";

/** Top of a profile: the avatar, handle, bio, counts
 * and stats. `action` sits top-right (settings key
 * on your own profile, follow button on someone else's). */
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

  return (
    <View>
      {(!!channel || !!action) && (
        <View className="flex-row items-center justify-between">
          {channel ? <ChannelLabel label={channel} /> : <View />}
          {action}
        </View>
      )}
      <View className={`${channel || action ? "mt-2" : ""} flex-row items-center gap-4`}>
        {user ? (
          <FadeInView className="flex-1 flex-row items-center gap-4">
            <Pressable
              onPress={() => setShowAvatarFullScreen(true)}
              disabled={!user.avatarUrl}
              accessibilityRole="imagebutton"
              accessibilityLabel={`View @${user.username}'s profile picture`}
            >
              <Avatar uri={user.avatarUrl} name={user.username} size={76} />
            </Pressable>
            <View className="flex-1">
              <FitText fontSize={48} numberOfLines={2} className="text-paper">
                {`@${user.username}`}
              </FitText>
            </View>
          </FadeInView>
        ) : (
          <>
            <Skeleton className="h-[76px] w-[76px] rounded-2xl" />
            <Skeleton className="h-10 w-44" />
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
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.08 }} resizeMode="cover" />
      </Pressable>
    </Modal>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  return (
    <Text className="font-display text-base uppercase text-paper/60">
      <Text className="font-numeric text-3xl text-paper">{value}</Text> {label}
    </Text>
  );
}

function Separator() {
  return <View className="h-1.5 w-1.5 bg-zine-red" />;
}

function ProfileCounts({ profile }: { profile: UserProfile | undefined }) {
  const { data: userStats } = useUserStats(profile?.user.username);

  if (!profile) {
    return (
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Separator />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-12" />
      </View>
    );
  }

  const { user, reviewCount, followerCount, followingCount } = profile;
  const djCount = userStats?.uniqueDjs ?? 0;

  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
      <Link href={ROUTES.USER_FOLLOWERS(user.username)}>
        <Count value={followerCount} label={pluralWord(followerCount, "follower")} />
      </Link>
      <Link href={ROUTES.USER_FOLLOWING(user.username)}>
        <Count value={followingCount} label="following" />
      </Link>
      <Separator />
      <Count value={reviewCount} label={pluralWord(reviewCount, "review")} />
      <Count value={djCount} label={pluralWord(djCount, "DJ")} />
    </View>
  );
}
