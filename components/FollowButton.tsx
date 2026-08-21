import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text } from "react-native";

import { useTRPC } from "../hooks/trpc";

export function FollowButton({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data } = useQuery(trpc.follows.isFollowing.queryOptions({ userId }));

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.follows.isFollowing.queryKey({ userId }),
    });

  const follow = useMutation(
    trpc.users.follow.mutationOptions({ onSuccess: invalidate }),
  );
  const unfollow = useMutation(
    trpc.users.unfollow.mutationOptions({ onSuccess: invalidate }),
  );

  const isFollowing = data?.following ?? false;
  const pending = follow.isPending || unfollow.isPending;

  return (
    <Pressable
      disabled={pending}
      onPress={() =>
        isFollowing
          ? unfollow.mutate({ userId })
          : follow.mutate({ userId })
      }
      className={`rounded-full px-4 py-2 ${isFollowing ? "bg-muted/20" : "bg-ink"}`}
    >
      <Text className={isFollowing ? "text-ink" : "text-paper"}>
        {isFollowing ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}
