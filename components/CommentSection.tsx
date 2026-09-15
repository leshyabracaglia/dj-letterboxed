import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { ReviewComment, User } from "../lib/api/types";

export function CommentSection({ reviewId }: { reviewId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments } = useQuery({
    queryKey: queryKeys.reviews.comments(reviewId),
    queryFn: () => api.get<ReviewComment[]>(`/api/reviews/${reviewId}/comments`),
  });
  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/api/users/me"),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.reviews.comments(reviewId) });

  const addComment = useMutation({
    mutationFn: (input: { body: string }) =>
      api.post<ReviewComment>(`/api/reviews/${reviewId}/comments`, input),
    onSuccess: () => {
      setBody("");
      invalidate();
    },
  });
  const deleteComment = useMutation({
    mutationFn: (id: string) => api.del(`/api/comments/${id}`),
    onSuccess: invalidate,
  });

  return (
    <View className="mt-4">
      <Text className="mb-2 text-lg font-semibold text-ink">Comments</Text>
      {(comments ?? []).map((comment) => (
        <View key={comment.id} className="mb-3 flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-medium text-ink">
              @{comment.user?.username}
            </Text>
            <Text className="text-sm text-ink">{comment.body}</Text>
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
          className="flex-1 rounded-lg border border-muted/30 bg-white px-4 py-2"
        />
        <Pressable
          disabled={!body.trim() || addComment.isPending}
          onPress={() => addComment.mutate({ body: body.trim() })}
          className="rounded-lg bg-ink px-4 py-2"
        >
          <Text className="text-paper">Post</Text>
        </Pressable>
      </View>
    </View>
  );
}
