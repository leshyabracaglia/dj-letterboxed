import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { Avatar, EmptyState, Page, Skeleton, Text, usePageContentStyle } from "./ui";
import { useApi } from "../lib/api/client";
import { useUserProfile } from "../lib/api/hooks";
import { queryKeys } from "../lib/api/queryKeys";
import type { User } from "../lib/api/types";
import { ROUTES } from "../lib/routes";

const COPY = {
  followers: { title: "Followers", empty: "No followers yet." },
  following: { title: "Following", empty: "Not following anyone yet." },
} as const;

export function UserListScreen({ mode }: { mode: "followers" | "following" }) {
  const { username } = useLocalSearchParams<{ username: string }>();
  const api = useApi();
  const contentStyle = usePageContentStyle();

  const { data: profile } = useUserProfile(username);
  const { data: list } = useQuery({
    queryKey:
      mode === "followers"
        ? queryKeys.users.followers(profile?.user.id ?? "")
        : queryKeys.users.following(profile?.user.id ?? ""),
    queryFn: () => api.get<User[]>(`/users/${profile?.user.id}/${mode}`),
    enabled: !!profile,
  });

  const { title, empty } = COPY[mode];

  return (
    <Page>
      <Stack.Screen options={{ title }} />
      <FlatList
        contentContainerStyle={[contentStyle, { paddingTop: 24 }]}
        data={list ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={ROUTES.USER(item.username)} asChild>
            <Pressable className="mb-2 flex-row items-center gap-3 rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark p-4 shadow-sm active:opacity-90">
              <Avatar uri={item.avatarUrl} name={item.displayName ?? item.username} size={36} />
              <View>
                <Text className="font-semibold text-ink dark:text-paper">{item.displayName ?? item.username}</Text>
                <Text className="text-muted">@{item.username}</Text>
              </View>
            </Pressable>
          </Link>
        )}
        ListEmptyComponent={
          list ? (
            <EmptyState message={empty} />
          ) : (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  className="mb-2 flex-row items-center gap-3 rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark p-4 shadow-sm"
                >
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <View>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1.5 h-3.5 w-20" />
                  </View>
                </View>
              ))}
            </>
          )
        }
      />
    </Page>
  );
}
