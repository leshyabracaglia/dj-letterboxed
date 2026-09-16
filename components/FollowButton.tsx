import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { Text } from "./Text";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { UserProfile } from "../lib/api/types";
import { ROUTES } from "../lib/routes";

type FollowingSnapshot = { following: boolean } | undefined;

/** `username` is optional so this still works anywhere we only have a userId;
 * pass it when available so the profile's follower count updates in step. */
export function FollowButton({ userId, username }: { userId: string; username?: string }) {
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
