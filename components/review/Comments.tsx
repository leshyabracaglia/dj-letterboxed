import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Avatar, Button, Icon, SectionTitle, Skeleton, Text, TextField } from "@/components/ui";
import { ModerationButton } from "@/components/ModerationSheet";
import { patchCachedReview } from "@/lib/api/cache";
import { useApi, unwrap } from "@/lib/api/client";
import { useReviewComments } from "@/lib/api/hooks";
import { queryKeys } from "@/lib/api/queryKeys";
import type { ReviewComment } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

// Comments go up before the server confirms them, under a temporary id.
const TEMP_ID_PREFIX = "temp-";

export function CommentSection({ reviewId }: { reviewId: string }) {
  const { isSignedIn, me } = useCurrentUser();
  const api = useApi();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const { data: comments } = useReviewComments(reviewId);

  const commentsKey = queryKeys.reviews.comments(reviewId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: commentsKey });
  // The detail query and every list card both carry the count.
  const bumpCommentCount = (by: number) =>
    patchCachedReview(queryClient, reviewId, (review) => ({
      ...review,
      commentCount: Math.max(0, (review.commentCount ?? 0) + by),
    }));

  const addComment = useMutation({
    mutationFn: (input: { body: string }) =>
      unwrap(api.POST("/api/reviews/{id}/comments", { params: { path: { id: reviewId } }, body: input })),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData<ReviewComment[]>(commentsKey);
      const optimisticComment: ReviewComment = {
        id: `${TEMP_ID_PREFIX}${Date.now()}`,
        reviewId,
        userId: me?.id ?? "",
        user: me,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ReviewComment[]>(commentsKey, (old) => [...(old ?? []), optimisticComment]);
      setBody("");
      bumpCommentCount(1);
      return { previous, submittedBody: input.body };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(commentsKey, ctx.previous);
      if (ctx?.submittedBody) setBody(ctx.submittedBody);
      bumpCommentCount(-1);
    },
    onSettled: invalidate,
  });
  const deleteComment = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/comments/{id}", { params: { path: { id } } })),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData<ReviewComment[]>(commentsKey);
      queryClient.setQueryData<ReviewComment[]>(commentsKey, (old) => (old ?? []).filter((c) => c.id !== id));
      bumpCommentCount(-1);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(commentsKey, ctx.previous);
      bumpCommentCount(1);
    },
    onSettled: invalidate,
  });

  return (
    <View className="gap-2">
      <SectionTitle>Comments</SectionTitle>
      <View className="gap-3">
        {(comments ?? []).map((comment) => (
          <View key={comment.id} className="flex-row items-start justify-between">
            <View className="flex-1 flex-row items-start gap-2 pr-2">
              <Avatar uri={comment.user?.avatarUrl} name={comment.user?.username ?? "?"} size={24} />
              <View className="flex-1">
                <Text variant="display" className="text-base text-paper/80">
                  @{comment.user?.username}
                </Text>
                <Text className="text-sm text-paper">{comment.body}</Text>
              </View>
            </View>
            {me?.id === comment.userId ? (
              <Pressable onPress={() => deleteComment.mutate(comment.id)}>
                <Text className="text-xs text-muted">Delete</Text>
              </Pressable>
            ) : (
              !!comment.user &&
              !comment.id.startsWith(TEMP_ID_PREFIX) && (
                <ModerationButton user={comment.user} target={{ commentId: comment.id }} />
              )
            )}
          </View>
        ))}
        {!comments ? (
          Array.from({ length: 2 }).map((_, i) => (
            <View key={i} className="flex-row items-start gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <View className="flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-1.5 h-3.5 w-3/4" />
              </View>
            </View>
          ))
        ) : !comments.length ? (
          <Text className="text-sm text-paper/60">No comments yet.</Text>
        ) : null}
        {isSignedIn ? (
          <View className="flex-row items-center gap-2">
            <TextField placeholder="Add a comment..." value={body} onChangeText={setBody} className="flex-1" />
            <Button
              disabled={!body.trim() || addComment.isPending}
              onPress={() => addComment.mutate({ body: body.trim() })}
              className="px-4 py-2"
            >
              <Text className="text-paper">Post</Text>
            </Button>
          </View>
        ) : (
          <Link href={ROUTES.SIGN_IN}>
            <Text className="text-primary-dark">Sign in to comment</Text>
          </Link>
        )}
      </View>
    </View>
  );
}

// The comment count beside the like button: the loaded comments' once
// they're in, the review's own count until then.
export function CommentCount({ reviewId, fallback }: { reviewId: string; fallback: number }) {
  const { data: comments } = useReviewComments(reviewId);
  return (
    <View className="flex-row items-center gap-1.5 rounded-lg bg-black/25 px-3 py-1.5">
      <Icon name="chatbubble-outline" size={15} className="text-paper" />
      <Text className="font-numeric text-lg leading-5 text-paper">{comments?.length ?? fallback}</Text>
    </View>
  );
}
