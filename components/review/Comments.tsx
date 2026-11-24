import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Avatar, Icon, SectionTitle, Skeleton, Text } from "@/components/ui";
import { ModerationButton } from "@/components/ModerationSheet";
import { track } from "@/lib/analytics";
import { patchCachedReview } from "@/lib/api/cache";
import { useApi, unwrap } from "@/lib/api/client";
import { useReviewComments } from "@/lib/api/hooks";
import { queryKeys } from "@/lib/api/queryKeys";
import type { ReviewComment } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { colors } from "@/lib/colors";
import { confirmDestructive } from "@/lib/dialog";
import { formatTimeAgo } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { ACTION_BOX } from "./actionBox";

// Comments go up before the server confirms them, under a temporary id.
const TEMP_ID_PREFIX = "temp-";

export function CommentSection({ reviewId }: { reviewId: string }) {
  const { isSignedIn, me } = useCurrentUser();
  const api = useApi();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [focused, setFocused] = useState(false);
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
    onSuccess: () => track("comment_posted"),
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

  const remove = async (id: string) => {
    const confirmed = await confirmDestructive({
      title: "Delete comment",
      message: "This removes your comment for everyone.",
    });
    if (confirmed) deleteComment.mutate(id);
  };
  const post = () => {
    const text = body.trim();
    if (text && !addComment.isPending) addComment.mutate({ body: text });
  };

  return (
    <View className="gap-3">
      <SectionTitle>{comments?.length ? `Comments · ${comments.length}` : "Comments"}</SectionTitle>
      <View className="gap-2">
        {comments?.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            isMine={me?.id === comment.userId}
            onDelete={() => void remove(comment.id)}
          />
        ))}
        {!comments &&
          Array.from({ length: 2 }).map((_, i) => (
            <View key={i} className="flex-row items-start gap-3 border border-white/5 bg-zine-panel/50 p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <View className="flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-2 h-3.5 w-3/4" />
              </View>
            </View>
          ))}
        {!!comments && !comments.length && (
          <View className="items-center gap-1 border border-dashed border-white/20 px-4 py-5">
            <Icon name="chatbubbles-outline" size={22} className="text-paper/50" />
            <Text className="text-center text-sm text-paper/60">No comments yet. Were you there too?</Text>
          </View>
        )}
      </View>

      {isSignedIn ? (
        // One bar: the text grows as you type, the send button sits at its
        // bottom right.
        <View
          className={`flex-row items-end gap-2 border-2 bg-zine-panel/90 py-1.5 pl-3 pr-1.5 ${focused ? "border-paper" : "border-white/15"}`}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Add a comment"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={MAX_COMMENT}
            accessibilityLabel="Comment"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="max-h-32 flex-1 py-2 text-[16px] text-paper"
          />
          <Pressable
            onPress={post}
            disabled={!body.trim() || addComment.isPending}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            className={`h-10 w-10 items-center justify-center bg-zine-purple active:opacity-80 ${
              body.trim() ? "" : "opacity-40"
            }`}
          >
            <Icon name="send" size={17} className="text-paper" />
          </Pressable>
        </View>
      ) : (
        <Link href={ROUTES.SIGN_IN} asChild>
          <Pressable className="items-center border border-white/15 bg-zine-panel/90 py-3 active:opacity-80">
            <Text variant="display" className="text-lg text-paper">
              Sign in to comment
            </Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

// The longest comment the API takes.
const MAX_COMMENT = 500;

// One comment on its panel: who (linked to their profile) and how long ago,
// what they said, and a way to delete your own or report someone else's.
// A comment still on its way up is faded with "Posting…".
function CommentRow({ comment, isMine, onDelete }: { comment: ReviewComment; isMine: boolean; onDelete: () => void }) {
  const pending = comment.id.startsWith(TEMP_ID_PREFIX);
  const user = comment.user;
  const openProfile = () => user && router.push(ROUTES.USER(user.username));
  return (
    <View
      className={`flex-row items-start gap-3 border border-white/10 bg-zine-panel/90 p-3 ${pending ? "opacity-60" : ""}`}
    >
      <Pressable onPress={openProfile} disabled={!user} accessibilityRole="link" className="active:opacity-80">
        <View className="overflow-hidden rounded-full">
          <Avatar uri={user?.avatarUrl} name={user?.username ?? "?"} size={32} />
        </View>
      </Pressable>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Pressable onPress={openProfile} disabled={!user} className="shrink active:opacity-80">
            <Text variant="display" className="text-lg leading-5 text-paper" numberOfLines={1}>
              {user?.username ?? "someone"}
            </Text>
          </Pressable>
          <Text className="text-xs text-paper/50">{pending ? "Posting…" : formatTimeAgo(comment.createdAt)}</Text>
        </View>
        <Text className="text-[15px] leading-5 text-paper/90">{comment.body}</Text>
      </View>
      {!pending &&
        (isMine ? (
          <Pressable
            onPress={onDelete}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Delete comment"
            className="p-1 active:opacity-70"
          >
            <Icon name="trash-outline" size={16} className="text-paper/50" />
          </Pressable>
        ) : (
          !!user && <ModerationButton user={user} target={{ commentId: comment.id }} />
        ))}
    </View>
  );
}

// The comment count beside the like button: the loaded comments' once
// they're in, the review's own count until then.
export function CommentCount({ reviewId, fallback }: { reviewId: string; fallback: number }) {
  const { data: comments } = useReviewComments(reviewId);
  const count = comments?.length ?? fallback;
  return (
    <View accessibilityLabel={`${count} comments`} className={`flex-1 ${ACTION_BOX}`}>
      <Icon name="chatbubble-outline" size={15} className="text-paper" />
      <Text className="font-numeric text-lg leading-5 text-paper">{count}</Text>
    </View>
  );
}
