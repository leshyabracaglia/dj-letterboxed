import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { ReviewCard } from "../../components/ReviewCard";
import { StatsSummary } from "../../components/StatsSummary";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Paginated, Review, User } from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

export default function ProfileScreen() {
  const api = useApi();
  const { signOut } = useAuth();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
  });
  const { data } = useQuery({
    queryKey: queryKeys.reviews.byUser(me?.username ?? ""),
    queryFn: () =>
      api.get<Paginated<Review>>(`/users/${me?.username}/reviews`, { limit: 20 }),
    enabled: !!me?.username,
  });

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <View className="px-4 pb-2 pt-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Avatar uri={me?.avatarUrl} name={me?.displayName ?? me?.username ?? "?"} size={72} />
            <View>
              <Text className="text-2xl font-bold text-ink dark:text-paper">
                {me?.displayName ?? me?.username ?? "Your profile"}
              </Text>
              {me?.username ? <Text className="text-muted">@{me.username}</Text> : null}
            </View>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push(ROUTES.SETTINGS)}
              className="rounded-full border border-primary/25 px-3 py-2"
            >
              <Text className="text-ink dark:text-paper">Settings</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                await signOut();
                router.replace(ROUTES.SIGN_IN);
              }}
              className="rounded-full border border-primary/25 px-3 py-2"
            >
              <Text className="text-ink dark:text-paper">Sign out</Text>
            </Pressable>
          </View>
        </View>
        {me?.bio ? <Text className="mt-2 text-ink dark:text-paper">{me.bio}</Text> : null}
        {me?.username ? <StatsSummary username={me.username} /> : null}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard log={{ ...item, user: me }} />}
        ListEmptyComponent={<EmptyState message="You haven't logged any sets yet." />}
      />
    </SafeAreaView>
  );
}
