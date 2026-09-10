import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, SafeAreaView, Text } from "react-native";

import { useTRPC } from "../../../hooks/trpc";
import { ROUTES } from "../../../lib/routes";

export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const trpc = useTRPC();

  const { data: profile } = useQuery(
    trpc.users.getByUsername.queryOptions({ username: username! }),
  );
  const { data: followers } = useQuery({
    ...trpc.users.getFollowers.queryOptions({ userId: profile?.user.id ?? "" }),
    enabled: !!profile,
  });

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title: "Followers" }} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={followers ?? []}
        keyExtractor={(item) => item.follower.id}
        renderItem={({ item }) => (
          <Link href={ROUTES.USER(item.follower.username)} asChild>
            <Pressable className="mb-2 rounded-xl border border-muted/20 bg-white p-4">
              <Text className="font-semibold text-ink">
                {item.follower.displayName ?? item.follower.username}
              </Text>
              <Text className="text-muted">@{item.follower.username}</Text>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={<Text className="mt-10 text-center text-muted">No followers yet.</Text>}
      />
    </SafeAreaView>
  );
}
