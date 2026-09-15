import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, SafeAreaView, Text, View } from "react-native";

import { FollowButton } from "../../components/FollowButton";
import { LogCard } from "../../components/LogCard";
import { StatsSummary } from "../../components/StatsSummary";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Paginated, Review, User, UserProfile } from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const api = useApi();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/api/users/me"),
  });
  const { data: profile } = useQuery({
    queryKey: queryKeys.users.byUsername(username!),
    queryFn: () => api.get<UserProfile>(`/api/users/${username}`),
  });
  const { data: logs } = useQuery({
    queryKey: queryKeys.reviews.byUser(username!),
    queryFn: () => api.get<Paginated<Review>>(`/api/users/${username}/reviews`, { limit: 20 }),
    enabled: !!username,
  });

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="text-muted">Loading...</Text>
      </SafeAreaView>
    );
  }

  const isSelf = me?.id === profile.user.id;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title: `@${profile.user.username}` }} />
      <View className="border-b border-muted/20 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-ink">
              {profile.user.displayName ?? profile.user.username}
            </Text>
            <Text className="text-muted">@{profile.user.username}</Text>
          </View>
          {!isSelf ? <FollowButton userId={profile.user.id} /> : null}
        </View>
        {profile.user.bio ? (
          <Text className="mt-2 text-ink">{profile.user.bio}</Text>
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
        renderItem={({ item }) => <LogCard log={{ ...item, user: profile.user }} />}
        ListEmptyComponent={
          <Text className="mt-10 text-center text-muted">No logs yet.</Text>
        }
      />
    </SafeAreaView>
  );
}
