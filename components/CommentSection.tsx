import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useTRPC } from "../hooks/trpc";

export function CommentSection({ reviewId }: { reviewId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments } = useQuery(trpc.reviews.listComments.queryOptions({ reviewId }));
  const { data: me } = useQuery(trpc.users.me.queryOptions());

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.reviews.listComments.queryKey({ reviewId }),
    });

  const addComment = useMutation(
    trpc.reviews.addComment.mutationOptions({
      onSuccess: () => {
        setBody("");
        invalidate();
      },
    }),
  );
  const deleteComment = useMutation(
    trpc.reviews.deleteComment.mutationOptions({ onSuccess: invalidate }),
  );

  return (
    <View className="mt-4">
      <Text className="mb-2 text-lg font-semibold text-ink">Comments</Text>
      {(comments ?? []).map((comment) => (
        <View key={comment.id} className="mb-3 flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-medium text-ink">
              @{comment.user.username}
            </Text>
            <Text className="text-sm text-ink">{comment.body}</Text>
          </View>
          {me?.id === comment.userId ? (
            <Pressable onPress={() => deleteComment.mutate({ id: comment.id })}>
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
          onPress={() => addComment.mutate({ reviewId, body: body.trim() })}
          className="rounded-lg bg-ink px-4 py-2"
        >
          <Text className="text-paper">Post</Text>
        </Pressable>
      </View>
    </View>
  );
}
