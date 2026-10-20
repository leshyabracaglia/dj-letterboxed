import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable } from "react-native";

import { Icon, Text } from "@/components/ui";
import { patchCachedReview } from "@/lib/api/cache";
import { useApi, unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queryKeys";
import { useCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export function LikeButton({
  reviewId,
  likeCount,
  isLiked,
  disabled = false,
}: {
  reviewId: string;
  likeCount: number;
  isLiked: boolean;
  // While the screen shows a list's copy of the review, there's no detail
  // query entry yet for the optimistic update to write to.
  disabled?: boolean;
}) {
  const { isSignedIn } = useCurrentUser();
  const api = useApi();
  const queryClient = useQueryClient();
  const reviewKey = queryKeys.reviews.byId(reviewId);

  // Written to the detail query and every list card's copy, so the counts
  // match on the way back.
  const setLiked = (liked: boolean) =>
    patchCachedReview(queryClient, reviewId, (review) =>
      !!review.isLikedByMe === liked
        ? review
        : { ...review, isLikedByMe: liked, likeCount: Math.max(0, (review.likeCount ?? 0) + (liked ? 1 : -1)) },
    );

  const applyOptimistic = async (liked: boolean) => {
    await queryClient.cancelQueries({ queryKey: reviewKey });
    setLiked(liked);
    return { liked };
  };

  const rollback = (ctx?: { liked: boolean }) => {
    if (ctx) setLiked(!ctx.liked);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: reviewKey });

  const like = useMutation({
    mutationFn: () => unwrap(api.POST("/api/reviews/{id}/like", { params: { path: { id: reviewId } } })),
    onMutate: () => applyOptimistic(true),
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidate,
  });
  const unlike = useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/reviews/{id}/like", { params: { path: { id: reviewId } } })),
    onMutate: () => applyOptimistic(false),
    onError: (_err, _vars, ctx) => rollback(ctx),
    onSettled: invalidate,
  });
  const pending = like.isPending || unlike.isPending;

  return (
    <Pressable
      disabled={pending || disabled}
      onPress={() => (isSignedIn ? (isLiked ? unlike.mutate() : like.mutate()) : router.push(ROUTES.SIGN_IN))}
      className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 active:opacity-80 ${
        isLiked ? "bg-black/60" : "bg-black/25"
      }`}
    >
      <Icon name={isLiked ? "heart" : "heart-outline"} size={16} className="text-paper" />
      <Text className="font-numeric text-lg leading-5 text-paper">{likeCount}</Text>
    </Pressable>
  );
}
