import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type RefObject } from "react";

import {
  Avatar,
  Button,
  Page,
  RatingStars,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useCurrentUser } from "../../lib/auth";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj, Event, Review, ReviewComment, User } from "../../lib/api/types";
import { formatDate } from "../../lib/format";
import { ROUTES } from "../../lib/routes";
import { captureStory, shareStory, WEB_URL, type CapturedStory } from "../../lib/shareStory";
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
  const { me } = useCurrentUser();

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
      {!comments ? (
        Array.from({ length: 2 }).map((_, i) => (
          <View key={i} className="mb-3 flex-row items-start gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <View className="flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-1.5 h-3.5 w-3/4" />
            </View>
          </View>
        ))
      ) : comments.length === 0 ? (
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
type ReviewDetail = Review & {
  dj: Dj;
  event: Event | null;
  taggedUsers: User[];
  user: User;
  likeCount: number;
  isLikedByMe: boolean;
};

// Word-boundary truncation for the story card. Done in JS rather than with
// numberOfLines because web capture (html2canvas) ignores CSS line clamping.
function snippet(text: string, max = 150) {
  const flat = text.trim().replace(/\s+/g, " ");
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// The 9:16 Instagram story image. Laid out on a 360-wide design grid and
// scaled by `width` so the on-screen preview and the 1080×1920 capture are
// the same drawing. Key content stays clear of the top ~10% / bottom ~12%,
// where Instagram overlays its progress bar, header and reply box.
// Sticks to flat colors, gradients and borders (no blur/shadow) so web
// capture via html2canvas matches native.
function StoryCard({
  review,
  width,
  cardRef,
  onImageSettled,
}: {
  review: ReviewDetail;
  width: number;
  cardRef: RefObject<View | null>;
  onImageSettled: () => void;
}) {
  const u = (n: number) => (n * width) / 360;
  const height = (width * 16) / 9;
  const djName = review.dj.name;
  const seen = new Date(review.seenAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={{ width, height, overflow: "hidden", backgroundColor: "#000000" }}
    >
      <LinearGradient
        colors={["#2A1745", "#0B0712", "#000000"]}
        locations={[0, 0.55, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          position: "absolute",
          width: u(340),
          height: u(340),
          borderRadius: u(170),
          top: u(36),
          left: u(10),
          backgroundColor: "rgba(136, 74, 207, 0.16)",
        }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: u(64),
          paddingBottom: u(80),
          paddingHorizontal: u(28),
          justifyContent: "space-between",
        }}
      >
        <View style={{ alignItems: "center" }}>
          <Text className="font-display" style={{ fontSize: u(30), color: "#BA95E4", letterSpacing: u(1) }}>
            BEATBOX&apos;D
          </Text>
          <Text style={{ fontSize: u(13), color: "#A4A0B1", marginTop: u(2) }}>
            @{review.user.username} caught
          </Text>
        </View>

        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: u(132),
              height: u(132),
              borderRadius: u(24),
              overflow: "hidden",
              borderWidth: u(2),
              borderColor: "rgba(186, 149, 228, 0.5)",
              backgroundColor: "#884ACF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {review.dj.imageUrl ? (
              <Image
                source={{ uri: review.dj.imageUrl }}
                onLoad={onImageSettled}
                onError={onImageSettled}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Text className="font-display" style={{ fontSize: u(52), color: "#FFFFFF" }}>
                {initials(djName)}
              </Text>
            )}
          </View>

          <Text
            className="font-display"
            style={{
              fontSize: u(djName.length > 16 ? 32 : 42),
              lineHeight: u(djName.length > 16 ? 34 : 44),
              color: "#F6F6F9",
              textAlign: "center",
              marginTop: u(12),
            }}
          >
            {djName}
          </Text>
          {review.event ? (
            <Text style={{ fontSize: u(13), color: "#BA95E4", textAlign: "center", marginTop: u(4) }}>
              {review.event.name} · {review.event.venue}
            </Text>
          ) : null}
          <Text style={{ fontSize: u(12), color: "#A4A0B1", marginTop: u(2) }}>{seen}</Text>
          {review.rating ? (
            <View style={{ marginTop: u(8) }}>
              <RatingStars value={review.rating} size={u(22)} />
            </View>
          ) : null}

          {review.reviewText ? (
            <View
              style={{
                marginTop: u(14),
                alignSelf: "stretch",
                borderRadius: u(16),
                borderWidth: u(1),
                borderColor: "rgba(186, 149, 228, 0.3)",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                paddingVertical: u(12),
                paddingHorizontal: u(16),
              }}
            >
              <Text style={{ fontSize: u(14), lineHeight: u(20), color: "#F6F6F9" }}>
                “{snippet(review.reviewText)}”
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: "center" }}>
          <View
            style={{
              backgroundColor: "#884ACF",
              borderRadius: u(999),
              paddingHorizontal: u(18),
              paddingVertical: u(9),
            }}
          >
            <Text className="font-bold" style={{ fontSize: u(13), color: "#FFFFFF" }}>
              Log the sets you&apos;ve seen
            </Text>
          </View>
          <Text style={{ fontSize: u(12), color: "#A4A0B1", marginTop: u(8) }}>
            Get the app or visit {WEB_URL.replace(/^https?:\/\//, "")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ShareStorySheet({ review, onClose }: { review: ReviewDetail; onClose: () => void }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // A multiple of 9 keeps the 9:16 height a whole number of pixels.
  const previewWidth =
    Math.floor(Math.min(297, windowWidth - 64, ((windowHeight - 280) * 9) / 16) / 9) * 9;
  const cardRef = useRef<View>(null);
  const prepared = useRef<CapturedStory | null>(null);
  const [imageSettled, setImageSettled] = useState(!review.dj.imageUrl);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const filename = `beatboxd-${review.dj.slug}.png`;
  const link = `${WEB_URL}${ROUTES.REVIEW_DETAIL(review.id) as string}`;

  // On web, render the PNG as soon as the preview has settled: html2canvas is
  // slow enough that doing it on tap can outlive the tap's user activation,
  // and navigator.share() then refuses to open.
  useEffect(() => {
    if (Platform.OS !== "web" || !imageSettled) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      captureStory(cardRef, filename)
        .then((story) => {
          if (!cancelled) prepared.current = story;
        })
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [imageSettled, filename]);

  const onShare = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const story = prepared.current ?? (await captureStory(cardRef, filename));
      const result = await shareStory(story, link);
      if (result === "downloaded") {
        setNotice("Image downloaded — post it to your story from your phone. Your review link is copied.");
      } else if (result === "shared") {
        setNotice("Review link copied — add a Link sticker in Instagram and paste it.");
      }
    } catch (err: any) {
      setNotice(err?.message ?? "Couldn't create the image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-ink/70 px-4">
      <Pressable
        onPress={(e) => e.stopPropagation()}
        className="items-center rounded-2xl bg-paper p-5 dark:bg-surface-dark"
      >
        <Text className="mb-3 text-lg font-display text-ink dark:text-paper">Share to your story</Text>
        <View className="overflow-hidden rounded-xl">
          <StoryCard
            review={review}
            width={previewWidth}
            cardRef={cardRef}
            onImageSettled={() => setImageSettled(true)}
          />
        </View>
        <Text className="mt-3 text-center text-xs text-muted" style={{ maxWidth: previewWidth + 40 }}>
          {notice ??
            "We'll copy a link to this review too — paste it into a Link sticker so friends can tap through."}
        </Text>
        <View className="mt-4 flex-row gap-3" style={{ width: previewWidth + 40 }}>
          <Button onPress={onShare} disabled={busy} className="flex-1 flex-row gap-2 py-3">
            {busy ? (
              <ActivityIndicator color="#F6F6F9" />
            ) : (
              <Ionicons name="logo-instagram" size={18} color="#F6F6F9" />
            )}
            <Text className="font-semibold text-paper">Share</Text>
          </Button>
          <Pressable
            onPress={onClose}
            className="flex-1 items-center justify-center rounded-full border border-primary/30 py-3"
          >
            <Text className="font-semibold text-ink dark:text-paper">Done</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

function ShareStoryButton({ review, justLogged }: { review: ReviewDetail; justLogged: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View
      className={`mt-4 w-full max-w-xl items-center rounded-2xl p-4 ${
        justLogged ? "border border-accent/40 bg-accent/10" : ""
      }`}
    >
      {justLogged ? (
        <Text className="mb-3 text-center text-base text-ink dark:text-paper">
          Set logged! Let your followers know who you saw.
        </Text>
      ) : null}
      <Button onPress={() => setOpen(true)} className="w-full flex-row gap-2 py-3">
        <Ionicons name="logo-instagram" size={18} color="#F6F6F9" />
        <Text className="font-semibold text-paper">Share to Instagram story</Text>
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open ? <ShareStorySheet review={review} onClose={() => setOpen(false)} /> : null}
      </Modal>
    </View>
  );
}

function ReviewDetailSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <View style={[contentStyle, { paddingTop: 24, alignItems: "center" }]}>
        <View className="w-full max-w-xl rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark p-5 shadow-sm">
          <View className="flex-row items-start justify-between gap-3">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-24" />
          </View>
          <Skeleton className="mt-3 h-4 w-52" />
          <Skeleton className="mt-2 h-3.5 w-28" />
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <View className="mt-4 flex-row items-center justify-between border-t border-primary/10 pt-4">
            <View className="flex-row items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3.5 w-32" />
            </View>
            <Skeleton className="h-8 w-14 rounded-full" />
          </View>
        </View>
      </View>
    </Page>
  );
}

export default function ReviewDetailScreen() {
  const { id, justLogged } = useLocalSearchParams<{ id: string; justLogged?: string }>();
  const api = useApi();
  const contentStyle = usePageContentStyle();
  const { me } = useCurrentUser();
  const { data: review } = useQuery({
    queryKey: queryKeys.reviews.byId(id!),
    queryFn: () => api.get<ReviewDetail>(`/reviews/${id}`),
  });

  if (!review) {
    return <ReviewDetailSkeleton />;
  }

  return (
    <Page>
      <Stack.Screen options={{ title: review.dj.name }} />
      <ScrollView contentContainerStyle={[contentStyle, { paddingTop: 24, alignItems: "center" }]}>
        <View className="w-full max-w-xl rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark p-5 shadow-sm">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Link href={ROUTES.DJ(review.dj.slug)}>
                <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                  {review.dj.name}
                </Text>
              </Link>
            </View>
            <RatingStars value={review.rating} size={16} />
          </View>

          {review.event && (
            <Link href={ROUTES.EVENT(review.event.id)}>
              <Text className="mt-2 text-sm font-medium text-accent-text dark:text-accent-dark">
                {review.event.name} · {review.event.venue}
              </Text>
            </Link>
          )}

          <Text className="mt-1 text-sm text-muted">Seen {formatDate(review.seenAt)}</Text>

          {review.crowdVibe && (
            <View className="mt-3">
              <CrowdVibeBadge vibe={review.crowdVibe} />
            </View>
          )}

          {review.reviewText && (
            <Text className="mt-4 text-base text-ink dark:text-paper">{review.reviewText}</Text>
          )}

          {review.taggedUsers && review.taggedUsers.length > 0 && (
            <Text className="mt-3 text-sm text-muted">
              With {review.taggedUsers.map((u) => `@${u.username}`).join(", ")}
            </Text>
          )}

          <View className="mt-4 flex-row items-center justify-between border-t border-primary/10 pt-4">
            <Link href={ROUTES.USER(review.user.username)} asChild>
              <Pressable className="flex-row items-center gap-2 active:opacity-80">
                <Avatar
                  uri={review.user.avatarUrl}
                  name={review.user.displayName ?? review.user.username}
                  size={28}
                />
                <Text className="text-sm text-muted">Reviewed by @{review.user.username}</Text>
              </Pressable>
            </Link>
            <LikeButton reviewId={review.id} likeCount={review.likeCount} isLiked={review.isLikedByMe} />
          </View>
        </View>

        {me?.id === review.userId ? (
          <ShareStoryButton review={review} justLogged={justLogged === "1"} />
        ) : null}

        <View className="w-full max-w-xl">
          <CommentSection reviewId={review.id} />
        </View>
      </ScrollView>
    </Page>
  );
}
