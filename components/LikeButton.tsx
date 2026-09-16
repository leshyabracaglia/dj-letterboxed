import { useAuth } from "@clerk/expo";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { Text } from "./Text";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { Review } from "../lib/api/types";
import { ROUTES } from "../lib/routes";

export function LikeButton({
  reviewId,
  likeCount,
  isLiked,
}: {
  reviewId: string;
  likeCount: number;
  isLiked: boolean;
}) {
  const { isSignedIn } = useAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const reviewKey = queryKeys.reviews.byId(reviewId);

  const applyOptimistic = async (liked: boolean) => {
    await queryClient.cancelQueries({ queryKey: reviewKey });
    const previous = queryClient.getQueryData<Review>(reviewKey);
    queryClient.setQueryData<Review>(reviewKey, (old) =>
      old
        ? {
            ...old,
            isLikedByMe: liked,
            likeCount: (old.likeCount ?? 0) + (liked ? 1 : -1),
          }
        : old,
    );
    return { previous };
  };

  const rollback = (ctx?: { previous?: Review }) => {
    if (ctx?.previous) queryClient.setQueryData(reviewKey, ctx.previous);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: reviewKey });

  const like = useMutation({
    mutationFn: () => api.post(`/reviews/${reviewId}/like`),
    onMutate: () => applyOptimistic(true),
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidate,
  });
  const unlike = useMutation({
    mutationFn: () => api.del(`/reviews/${reviewId}/like`),
    onMutate: () => applyOptimistic(false),
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidate,
  });
  const pending = like.isPending || unlike.isPending;

  return (
    <Pressable
      disabled={pending}
      onPress={() =>
        isSignedIn ? (isLiked ? unlike.mutate() : like.mutate()) : router.push(ROUTES.SIGN_IN)
      }
      className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 active:opacity-80 ${
        isLiked ? "bg-accent/15" : "bg-muted/10"
      }`}
    >
      <Text className={isLiked ? "text-accent-text dark:text-accent-dark" : "text-ink dark:text-paper"}>
        {isLiked ? "♥" : "♡"} {likeCount}
      </Text>
    </Pressable>
  );
}
