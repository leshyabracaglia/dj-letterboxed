import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { FollowButton } from "../../components/FollowButton";
import { ReviewCard } from "../../components/ReviewCard";
import { ScreenLoading } from "../../components/ScreenLoading";
import { StatsSummary } from "../../components/StatsSummary";
import { useApi } from "../../lib/api/client";
import { useUserProfile } from "../../lib/api/hooks";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Paginated, Review, User } from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const api = useApi();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
  });
  const { data: profile } = useUserProfile(username);
  const { data: logs } = useQuery({
    queryKey: queryKeys.reviews.byUser(username!),
    queryFn: () => api.get<Paginated<Review>>(`/users/${username}/reviews`, { limit: 20 }),
    enabled: !!username,
  });

  if (!profile) {
    return <ScreenLoading />;
  }

  const isSelf = me?.id === profile.user.id;

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: `@${profile.user.username}` }} />
      <View className="border-b border-primary/15 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Avatar
              uri={profile.user.avatarUrl}
              name={profile.user.displayName ?? profile.user.username}
              size={48}
            />
            <View>
              <Text className="text-2xl font-bold text-ink dark:text-paper">
                {profile.user.displayName ?? profile.user.username}
              </Text>
              <Text className="text-muted">@{profile.user.username}</Text>
            </View>
          </View>
          {!isSelf ? (
            <FollowButton userId={profile.user.id} username={profile.user.username} />
          ) : null}
        </View>
        {profile.user.bio ? (
          <Text className="mt-2 text-ink dark:text-paper">{profile.user.bio}</Text>
        ) : null}
        <View className="mt-3 flex-row gap-4">
          <Text className="text-muted">{profile.logCount} logs</Text>
          <Link href={ROUTES.USER_FOLLOWERS(profile.user.username)}>
            <Text className="text-muted">{profile.followerCount} followers</Text>
          </Link>
          <Link href={ROUTES.USER_FOLLOWING(profile.user.username)}>
            <Text className="text-muted">{profile.followingCount} following</Text>
          </Link>
        </View>
        <StatsSummary username={profile.user.username} />
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={logs?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard log={{ ...item, user: profile.user }} />}
        ListEmptyComponent={<EmptyState message="No logs yet." />}
      />
    </SafeAreaView>
  );
}
