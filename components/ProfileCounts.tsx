import { Link } from "expo-router";
import { View } from "react-native";
import { Skeleton, Text } from "./ui";

import { useUserStats } from "../lib/api/hooks";
import type { UserProfile } from "../lib/api/types";
import { ROUTES } from "../lib/routes";

function Count({ value, label }: { value: number; label: string }) {
  return (
    <Text className="text-muted">
      <Text className="font-numeric text-2xl text-ink dark:text-paper mt-3">{value}</Text>  {label}
    </Text>
  );
}

function Separator() {
  return <View className="h-1 w-1 rounded-full bg-muted" />;
}

/** A profile's counts in one left-aligned row: followers/following (linking
 * to those lists), a dot separator, then reviews/DJs. Skeleton while
 * `profile` loads. */
export function ProfileCounts({ profile }: { profile: UserProfile | undefined }) {
  const { data: stats } = useUserStats(profile?.user.username);

  if (!profile) {
    return (
      <View className="mt-3 flex-row items-center gap-4">
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
    <View className="mt-3 flex-row items-center gap-4">
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
