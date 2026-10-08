import { Link } from "expo-router";
import { View } from "react-native";
import { Skeleton, Text } from "./ui";

import { useUserStats } from "../lib/api/hooks";
import type { UserProfile } from "../lib/api/types";
import { ROUTES } from "../lib/routes";

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

/** A profile's counts in one left-aligned row: followers/following (linking
 * to those lists), a dot separator, then reviews/DJs. Skeleton while
 * `profile` loads. */
export function ProfileCounts({ profile }: { profile: UserProfile | undefined }) {
  const { data: stats } = useUserStats(profile?.user.username);

  if (!profile) {
    return (
      <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Separator />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-12" />
      </View>
    );
  }
  const { user, reviewCount, followerCount, followingCount } = profile;
  const djCount = stats?.uniqueDjs ?? 0;
  return (
    <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-1">
      <Link href={ROUTES.USER_FOLLOWERS(user.username)}>
        <Count value={followerCount} label={followerCount === 1 ? "follower" : "followers"} />
      </Link>
      <Link href={ROUTES.USER_FOLLOWING(user.username)}>
        <Count value={followingCount} label="following" />
      </Link>
      <Separator />
      <Count value={reviewCount} label={reviewCount === 1 ? "review" : "reviews"} />
      <Count value={djCount} label={djCount === 1 ? "DJ" : "DJs"} />
    </View>
  );
}
