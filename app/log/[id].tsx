import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useState } from "react";

import {
  Avatar,
  Button,
  Page,
  RatingStars,
  ScreenLoading,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj, Event, Review, ReviewComment, User } from "../../lib/api/types";
import { formatDate } from "../../lib/format";
import { ROUTES } from "../../lib/routes";
import { CrowdVibeBadge } from "../../components/CrowdVibeBadge";

function CommentSection({ reviewId }: { reviewId: string }) {
  const { isSignedIn } = useAuth();
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
    enabled: isSignedIn,
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
      <Text className="mb-2 text-xl font-display text-ink dark:text-paper">Comments</Text>
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
      {isSignedIn ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            placeholder="Add a comment..."
            value={body}
            onChangeText={setBody}
            className="flex-1 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-2 text-ink dark:text-paper placeholder:text-muted"
          />
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
          <Text className="text-primary dark:text-primary-dark">Sign in to comment</Text>
        </Link>
      )}
    </View>
  );
}

function LikeButton({
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

// getById always hydrates these relations, so narrow them to required here.
type LogDetail = Review & {
  dj: Dj;
  event: Event | null;
  taggedUsers: User[];
  user: User;
  likeCount: number;
  isLikedByMe: boolean;
};

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const contentStyle = usePageContentStyle();
  const { data: log } = useQuery({
    queryKey: queryKeys.reviews.byId(id!),
    queryFn: () => api.get<LogDetail>(`/reviews/${id}`),
  });

  if (!log) {
    return <ScreenLoading />;
  }

  return (
    <Page>
      <Stack.Screen options={{ title: log.dj.name }} />
      <ScrollView contentContainerStyle={[contentStyle, { paddingTop: 24, alignItems: "center" }]}>
        <View className="w-full max-w-xl rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark p-5 shadow-sm">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Link href={ROUTES.DJ(log.dj.slug)}>
                <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                  {log.dj.name}
                </Text>
              </Link>
            </View>
            <RatingStars value={log.rating} size={16} />
          </View>

          {log.event ? (
            <Link href={ROUTES.EVENT(log.event.id)}>
              <Text className="mt-2 text-sm font-medium text-accent-text dark:text-accent-dark">
                {log.event.name} · {log.event.venue}
              </Text>
            </Link>
          ) : null}

          <Text className="mt-1 text-sm text-muted">Seen {formatDate(log.seenAt)}</Text>

          {log.crowdVibe ? (
            <View className="mt-3">
              <CrowdVibeBadge vibe={log.crowdVibe} />
            </View>
          ) : null}

          {log.reviewText ? (
            <Text className="mt-4 text-base text-ink dark:text-paper">{log.reviewText}</Text>
          ) : null}

          {log.taggedUsers && log.taggedUsers.length > 0 ? (
            <Text className="mt-3 text-sm text-muted">
              With {log.taggedUsers.map((u) => `@${u.username}`).join(", ")}
            </Text>
          ) : null}

          <View className="mt-4 flex-row items-center justify-between border-t border-primary/10 pt-4">
            <Link href={ROUTES.USER(log.user.username)} asChild>
              <Pressable className="flex-row items-center gap-2 active:opacity-80">
                <Avatar
                  uri={log.user.avatarUrl}
                  name={log.user.displayName ?? log.user.username}
                  size={28}
                />
                <Text className="text-sm text-muted">Logged by @{log.user.username}</Text>
              </Pressable>
            </Link>
            <LikeButton reviewId={log.id} likeCount={log.likeCount} isLiked={log.isLikedByMe} />
          </View>
        </View>

        <View className="w-full max-w-xl">
          <CommentSection reviewId={log.id} />
        </View>
      </ScrollView>
    </Page>
  );
}
