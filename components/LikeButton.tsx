import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text } from "react-native";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";

export function LikeButton({
  reviewId,
  likeCount,
  isLiked,
}: {
  reviewId: string;
  likeCount: number;
  isLiked: boolean;
}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byId(reviewId) });

  const like = useMutation({
    mutationFn: () => api.post(`/reviews/${reviewId}/like`),
    onSuccess: invalidate,
  });
  const unlike = useMutation({
    mutationFn: () => api.del(`/reviews/${reviewId}/like`),
    onSuccess: invalidate,
  });
  const pending = like.isPending || unlike.isPending;

  return (
    <Pressable
      disabled={pending}
      onPress={() => (isLiked ? unlike.mutate() : like.mutate())}
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
