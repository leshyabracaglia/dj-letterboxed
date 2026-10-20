import { skipToken, useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { Avatar, EmptyState, Page, RowSeparator, Skeleton, Text, usePageContentStyle } from "./ui";
import { unwrap, useApi } from "@/lib/api/client";
import { useUserProfile } from "@/lib/api/hooks";
import { queryKeys } from "@/lib/api/queryKeys";
import { ROUTES } from "@/lib/routes";

const USER_LIST_TYPES = {
  FOLLOWING: "following",
  FOLLOWERS: "followers",
};

type UserListType = (typeof USER_LIST_TYPES)[keyof typeof USER_LIST_TYPES];

const USER_LIST_TYPE_COPY = {
  [USER_LIST_TYPES.FOLLOWERS]: { title: "Followers", empty: "No followers yet." },
  [USER_LIST_TYPES.FOLLOWING]: { title: "Following", empty: "Not following anyone yet." },
} as const;

export function UserListScreen({ userListMode }: { userListMode: UserListType }) {
  const { username } = useLocalSearchParams<{ username: string }>();
  const api = useApi();
  const contentStyle = usePageContentStyle("roomy");

  const { data: profile } = useUserProfile(username);
  const userId = profile?.user.id;
  const isFollowers = userListMode === USER_LIST_TYPES.FOLLOWERS;
  const { data: list } = useQuery({
    queryKey: isFollowers ? queryKeys.users.followers(userId ?? "") : queryKeys.users.following(userId ?? ""),
    queryFn: userId
      ? () => {
          const init = { params: { path: { userId } } };
          return unwrap(
            isFollowers
              ? api.GET("/api/users/{userId}/followers", init)
              : api.GET("/api/users/{userId}/following", init),
          );
        }
      : skipToken,
  });

  const { title, empty } = USER_LIST_TYPE_COPY[userListMode];

  return (
    <Page>
      <Stack.Screen options={{ title }} />
      <FlatList
        contentContainerStyle={contentStyle}
        data={list ?? []}
        keyExtractor={(user) => user.id}
        renderItem={({ item: user }) => (
          <Link href={ROUTES.USER(user.username)} asChild>
            <Pressable className="flex-row items-center gap-3 border border-white/10 bg-zine-panel/90 p-4 shadow-sm active:opacity-90">
              <Avatar uri={user.avatarUrl} name={user.username} size={36} />
              <View>
                <Text className="font-semibold text-paper">{user.username}</Text>
              </View>
            </Pressable>
          </Link>
        )}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          list ? (
            <View className="mt-10">
              <EmptyState message={empty} />
            </View>
          ) : (
            <View className="gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  className="flex-row items-center gap-3 border border-white/10 bg-zine-panel/90 p-4 shadow-sm"
                >
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <View>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1.5 h-3.5 w-20" />
                  </View>
                </View>
              ))}
            </View>
          )
        }
      />
    </Page>
  );
}
