import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text } from "react-native";

import { useTRPC } from "../hooks/trpc";

export function LikeButton({
  reviewId,
  likeCount,
  isLiked,
}: {
  reviewId: string;
  likeCount: number;
  isLiked: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.reviews.getById.queryKey({ id: reviewId }),
    });

  const like = useMutation(trpc.reviews.like.mutationOptions({ onSuccess: invalidate }));
  const unlike = useMutation(trpc.reviews.unlike.mutationOptions({ onSuccess: invalidate }));
  const pending = like.isPending || unlike.isPending;

  return (
    <Pressable
      disabled={pending}
      onPress={() =>
        isLiked ? unlike.mutate({ reviewId }) : like.mutate({ reviewId })
      }
      className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${
        isLiked ? "bg-accent/15" : "bg-muted/10"
      }`}
    >
      <Text className={isLiked ? "text-accent" : "text-ink"}>
        {isLiked ? "♥" : "♡"} {likeCount}
      </Text>
    </Pressable>
  );
}
