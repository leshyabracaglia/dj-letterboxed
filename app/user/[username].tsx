import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";
import {
  Avatar,
  EmptyState,
  Page,
  PageHeader,
  ScreenLoading,
  Text,
  usePageContentStyle,
} from "../../components/ui";

import { FavoritesShowcase } from "../../components/FavoritesShowcase";
import { ReviewCard } from "../../components/ReviewCard";
import { StatsSummary } from "../../components/StatsSummary";
import { useApi } from "../../lib/api/client";
import { useUserProfile } from "../../lib/api/hooks";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Paginated, Review, User, UserProfile } from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

type FollowingSnapshot = { following: boolean } | undefined;

/** `username` is optional so this still works anywhere we only have a userId;
 * pass it when available so the profile's follower count updates in step. */
function FollowButton({ userId, username }: { userId: string; username?: string }) {
  const { isSignedIn } = useAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const followingKey = queryKeys.follows.isFollowing(userId);
  const profileKey = username ? queryKeys.users.byUsername(username) : undefined;

  const { data } = useQuery({
    queryKey: followingKey,
    queryFn: () => api.get<{ following: boolean }>(`/follows/is-following/${userId}`),
    enabled: isSignedIn,
  });

  const applyOptimistic = async (following: boolean) => {
    await queryClient.cancelQueries({ queryKey: followingKey });
    const previousFollowing = queryClient.getQueryData<FollowingSnapshot>(followingKey);
    queryClient.setQueryData<{ following: boolean }>(followingKey, { following });

    let previousProfile: UserProfile | undefined;
    if (profileKey) {
      await queryClient.cancelQueries({ queryKey: profileKey });
      previousProfile = queryClient.getQueryData<UserProfile>(profileKey);
      if (previousProfile) {
        queryClient.setQueryData<UserProfile>(profileKey, {
          ...previousProfile,
          followerCount: previousProfile.followerCount + (following ? 1 : -1),
        });
      }
    }
    return { previousFollowing, previousProfile };
  };

  const rollback = (ctx?: { previousFollowing: FollowingSnapshot; previousProfile?: UserProfile }) => {
    if (!ctx) return;
    queryClient.setQueryData(followingKey, ctx.previousFollowing);
    if (profileKey && ctx.previousProfile) {
      queryClient.setQueryData(profileKey, ctx.previousProfile);
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: followingKey });
    if (profileKey) queryClient.invalidateQueries({ queryKey: profileKey });
  };

  const follow = useMutation({
    mutationFn: () => api.post(`/follows/${userId}`),
    onMutate: () => applyOptimistic(true),
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidate,
  });
  const unfollow = useMutation({
    mutationFn: () => api.del(`/follows/${userId}`),
    onMutate: () => applyOptimistic(false),
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  const isFollowing = data?.following ?? false;
  const pending = follow.isPending || unfollow.isPending;

  return (
    <Pressable
      disabled={pending}
      onPress={() =>
        isSignedIn
          ? isFollowing
            ? unfollow.mutate()
            : follow.mutate()
          : router.push(ROUTES.SIGN_IN)
      }
      className={`rounded-full px-4 py-2 active:opacity-80 ${isFollowing ? "bg-muted/20" : "bg-primary"}`}
    >
      <Text className={isFollowing ? "text-ink dark:text-paper" : "text-paper"}>
        {isFollowing ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { isSignedIn } = useAuth();
  const api = useApi();
  const contentStyle = usePageContentStyle();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
    enabled: isSignedIn,
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
    <Page>
      <Stack.Screen options={{ title: `@${profile.user.username}` }} />
      <PageHeader border="primary">
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
          <Text className="text-muted">
            <Text className="font-numeric text-2xl text-ink dark:text-paper mt-1">{profile.logCount}</Text> log{profile.logCount === 1 ? "" : "s"}
          </Text>
          <Link href={ROUTES.USER_FOLLOWERS(profile.user.username)}>
            <Text className="text-muted">
              <Text className="font-numeric text-2xl text-ink dark:text-paper mt-1">{profile.followerCount}</Text>{" "}
              follower{profile.followerCount === 1 ? "" : "s"}
            </Text>
          </Link>
          <Link href={ROUTES.USER_FOLLOWING(profile.user.username)}>
            <Text className="text-muted">
              <Text className="font-numeric text-2xl text-ink dark:text-paper mt-1">{profile.followingCount}</Text>{" "}
              following{profile.followingCount === 1 ? "" : "s"}
            </Text>
          </Link>
        </View>
        <StatsSummary username={profile.user.username} />
        <FavoritesShowcase
          username={profile.user.username}
          isSelf={isSelf}
          ownReviews={isSelf ? (logs?.items ?? []) : undefined}
        />
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={logs?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard log={{ ...item, user: profile.user }} />}
        ListEmptyComponent={<EmptyState message="No logs yet." />}
      />
    </Page>
  );
}
