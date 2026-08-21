import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, SafeAreaView, Text, View } from "react-native";

import { LogCard } from "../../components/LogCard";
import { useTRPC } from "../../hooks/trpc";

export default function ProfileScreen() {
  const trpc = useTRPC();
  const { signOut } = useAuth();

  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const { data } = useQuery({
    ...trpc.logs.listByUser.queryOptions({ username: me?.username ?? "" }),
    enabled: !!me?.username,
  });

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-4 pb-2 pt-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-ink">
              {me?.displayName ?? me?.username ?? "Your profile"}
            </Text>
            {me?.username ? <Text className="text-muted">@{me.username}</Text> : null}
          </View>
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/(auth)/sign-in");
            }}
            className="rounded-full border border-muted/30 px-3 py-2"
          >
            <Text className="text-ink">Sign out</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LogCard log={{ ...item, user: me }} />}
        ListEmptyComponent={
          <Text className="mt-10 text-center text-muted">
            You haven&apos;t logged any sets yet.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
