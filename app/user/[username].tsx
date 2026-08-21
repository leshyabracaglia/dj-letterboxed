import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, SafeAreaView, Text, View } from "react-native";

import { FollowButton } from "../../components/FollowButton";
import { LogCard } from "../../components/LogCard";
import { useTRPC } from "../../hooks/trpc";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const trpc = useTRPC();

  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const { data: profile } = useQuery(
    trpc.users.getByUsername.queryOptions({ username: username! }),
  );
  const { data: logs } = useQuery({
    ...trpc.logs.listByUser.queryOptions({ username: username! }),
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
          <Link href={`/user/${profile.user.username}/followers`}>
            <Text className="text-muted">{profile.followerCount} followers</Text>
          </Link>
          <Link href={`/user/${profile.user.username}/following`}>
            <Text className="text-muted">{profile.followingCount} following</Text>
          </Link>
        </View>
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
