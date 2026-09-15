import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, SafeAreaView, Text } from "react-native";

import { useApi } from "../../../lib/api/client";
import { queryKeys } from "../../../lib/api/queryKeys";
import type { User, UserProfile } from "../../../lib/api/types";
import { ROUTES } from "../../../lib/routes";

export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const api = useApi();

  const { data: profile } = useQuery({
    queryKey: queryKeys.users.byUsername(username!),
    queryFn: () => api.get<UserProfile>(`/api/users/${username}`),
  });
  const { data: followers } = useQuery({
    queryKey: queryKeys.users.followers(profile?.user.id ?? ""),
    queryFn: () => api.get<User[]>(`/api/users/${profile?.user.id}/followers`),
    enabled: !!profile,
  });

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title: "Followers" }} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={followers ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={ROUTES.USER(item.username)} asChild>
            <Pressable className="mb-2 rounded-xl border border-muted/20 bg-white p-4">
              <Text className="font-semibold text-ink">
                {item.displayName ?? item.username}
              </Text>
              <Text className="text-muted">@{item.username}</Text>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={<Text className="mt-10 text-center text-muted">No followers yet.</Text>}
      />
    </SafeAreaView>
  );
}
