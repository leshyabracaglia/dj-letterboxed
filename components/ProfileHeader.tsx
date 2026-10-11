import type { ReactNode } from "react";
import { View } from "react-native";

import type { User, UserProfile } from "../lib/api/types";
import { ProfileCounts } from "./ProfileCounts";
import { StatsSummary } from "./StatsSummary";
import { Avatar, ChannelLabel, FadeInView, FitText, Skeleton, Text } from "./ui";

/** Top of a profile: the avatar, the handle in big pixel type, bio, counts
 * and stats. `action` sits top-right (settings key
 * on your own profile, follow button on someone else's). Rendered as the
 * reviews list's header so the whole profile scrolls together, which is why
 * it has no gutter of its own: the list's content style supplies it. */
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
    <View className="mb-4">
      {(!!channel || !!action) && (
        <View className="mb-2 flex-row items-center justify-between">
          {channel ? <ChannelLabel label={channel} /> : <View />}
          {action}
        </View>
      )}
      <View className="flex-row items-center gap-4">
        {user ? (
          <FadeInView className="flex-1 flex-row items-center gap-4">
            <Avatar uri={user.avatarUrl} name={user.username} size={76} />
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
      <ProfileCounts profile={profile} />
      {!!user?.username && <StatsSummary username={user.username} />}
    </View>
  );
}
