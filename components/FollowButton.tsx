import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text } from "react-native";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";

export function FollowButton({ userId }: { userId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.follows.isFollowing(userId),
    queryFn: () => api.get<{ following: boolean }>(`/api/follows/is-following/${userId}`),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.follows.isFollowing(userId) });

  const follow = useMutation({
    mutationFn: () => api.post(`/api/follows/${userId}`),
    onSuccess: invalidate,
  });
  const unfollow = useMutation({
    mutationFn: () => api.del(`/api/follows/${userId}`),
    onSuccess: invalidate,
  });

  const isFollowing = data?.following ?? false;
  const pending = follow.isPending || unfollow.isPending;

  return (
    <Pressable
      disabled={pending}
      onPress={() => (isFollowing ? unfollow.mutate() : follow.mutate())}
      className={`rounded-full px-4 py-2 ${isFollowing ? "bg-muted/20" : "bg-ink"}`}
    >
      <Text className={isFollowing ? "text-ink" : "text-paper"}>
        {isFollowing ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}
