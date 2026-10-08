import type { ReactNode } from "react";
import { View } from "react-native";

import type { User, UserProfile } from "../lib/api/types";
import { ProfileCounts } from "./ProfileCounts";
import { StatsSummary } from "./StatsSummary";
import { Avatar, ChannelLabel, FadeInView, FitText, PageHeader, Skeleton, Text } from "./ui";

/** Top of a profile: the avatar as a taped-up snapshot, the handle in big
 * pixel type, bio, counts and stats. `action` sits top-right (settings key
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
  return (
    <PageHeader border="primary">
      {(!!channel || !!action) && (
        <View className="mb-3 flex-row items-center justify-between">
          {channel ? <ChannelLabel label={channel} /> : <View />}
          {action}
        </View>
      )}
      <View className="flex-row items-center gap-4">
        {user ? (
          <FadeInView className="flex-1 flex-row items-center gap-4">
            <View className="border-4 border-paper bg-paper shadow-lg shadow-black/60" style={{ transform: [{ rotate: "-3deg" }] }}>
              <Avatar uri={user.avatarUrl} name={user.username} size={76} />
            </View>
            <View className="flex-1">
              <FitText fontSize={48} numberOfLines={2} className="text-paper">
                {`@${user.username}`}
              </FitText>
            </View>
          </FadeInView>
        ) : (
          <>
            <Skeleton className="h-[84px] w-[84px] rounded-none" />
            <Skeleton className="h-10 w-44" />
          </>
        )}
      </View>
      {!!user?.bio && <Text className="mt-3 text-base text-paper">{user.bio}</Text>}
      <ProfileCounts profile={profile} />
      {!!user?.username && <StatsSummary username={user.username} />}
    </PageHeader>
  );
}
