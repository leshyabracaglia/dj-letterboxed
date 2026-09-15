import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "./Text";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { ReviewComment, User } from "../lib/api/types";
import { Avatar } from "./Avatar";

export function CommentSection({ reviewId }: { reviewId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments } = useQuery({
    queryKey: queryKeys.reviews.comments(reviewId),
    queryFn: () => api.get<ReviewComment[]>(`/reviews/${reviewId}/comments`),
  });
  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
  });

  const commentsKey = queryKeys.reviews.comments(reviewId);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: commentsKey });

  const addComment = useMutation({
    mutationFn: (input: { body: string }) =>
      api.post<ReviewComment>(`/reviews/${reviewId}/comments`, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData<ReviewComment[]>(commentsKey);
      const optimisticComment: ReviewComment = {
        id: `temp-${Date.now()}`,
        reviewId,
        userId: me?.id ?? "",
        user: me,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ReviewComment[]>(commentsKey, (old) => [
        ...(old ?? []),
        optimisticComment,
      ]);
      setBody("");
      return { previous, submittedBody: input.body };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(commentsKey, ctx.previous);
      if (ctx?.submittedBody) setBody(ctx.submittedBody);
    },
    onSettled: invalidate,
  });
  const deleteComment = useMutation({
    mutationFn: (id: string) => api.del(`/comments/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData<ReviewComment[]>(commentsKey);
      queryClient.setQueryData<ReviewComment[]>(commentsKey, (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(commentsKey, ctx.previous);
    },
    onSettled: invalidate,
  });

  return (
    <View className="mt-4">
      <Text className="mb-2 text-lg font-display text-ink dark:text-paper">Comments</Text>
      {(comments ?? []).map((comment) => (
        <View key={comment.id} className="mb-3 flex-row items-start justify-between">
          <View className="flex-1 flex-row items-start gap-2 pr-2">
            <Avatar
              uri={comment.user?.avatarUrl}
              name={comment.user?.displayName ?? comment.user?.username ?? "?"}
              size={24}
            />
            <View className="flex-1">
              <Text className="text-sm font-medium text-ink dark:text-paper">@{comment.user?.username}</Text>
              <Text className="text-sm text-ink dark:text-paper">{comment.body}</Text>
            </View>
          </View>
          {me?.id === comment.userId ? (
            <Pressable onPress={() => deleteComment.mutate(comment.id)}>
              <Text className="text-xs text-muted">Delete</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {(comments ?? []).length === 0 ? (
        <Text className="mb-3 text-sm text-muted">No comments yet.</Text>
      ) : null}
      <View className="flex-row items-center gap-2">
        <TextInput
          placeholder="Add a comment..."
          value={body}
          onChangeText={setBody}
          className="flex-1 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-2"
        />
        <Pressable
          disabled={!body.trim() || addComment.isPending}
          onPress={() => addComment.mutate({ body: body.trim() })}
          className="rounded-lg bg-primary px-4 py-2"
        >
          <Text className="text-paper">Post</Text>
        </Pressable>
      </View>
    </View>
  );
}
