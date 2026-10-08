import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
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
  Card,
  FitText,
  Icon,
  KeyboardScrollView,
  Page,
  paperFor,
  RatingStamp,
  RatingStars,
  Skeleton,
  Tape,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useCurrentUser } from "../../lib/auth";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj, Review, ReviewComment, User } from "../../lib/api/types";
import { formatCardDate, formatEventTiming } from "../../lib/format";
import { logWhere, reviewSubject } from "../../lib/review";
import { ROUTES } from "../../lib/routes";
import { captureStory, shareStory, WEB_URL, type CapturedStory } from "../../lib/shareStory";
import { ReviewTags } from "../../components/ReviewTags";
import { isIos } from "@/lib/utils";

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
      <Text className="mb-3 mt-2 font-display text-2xl uppercase text-paper/85">Comments</Text>
      {(comments ?? []).map((comment) => (
        <View key={comment.id} className="mb-3 flex-row items-start justify-between">
          <View className="flex-1 flex-row items-start gap-2 pr-2">
            <Avatar
              uri={comment.user?.avatarUrl}
              name={comment.user?.username ?? "?"}
              size={24}
            />
            <View className="flex-1">
              <Text className="font-display text-base uppercase text-paper/80">@{comment.user?.username}</Text>
              <Text className="text-sm text-ink dark:text-paper">{comment.body}</Text>
            </View>
          </View>
          {me?.id === comment.userId && (
            <Pressable onPress={() => deleteComment.mutate(comment.id)}>
              <Text className="text-xs text-muted">Delete</Text>
            </Pressable>
          )}
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
      ) : !comments.length ? (
        <Text className="mb-3 text-sm text-paper/60">No comments yet.</Text>
      ) : null}
      {isSignedIn ? (
        <View className="flex-row items-center gap-2">
          <TextInput
            placeholder="Add a comment..."
            value={body}
            onChangeText={setBody}
            className="flex-1 rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-2 text-paper"
            placeholderTextColor="rgba(246,246,249,0.4)"
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
  disabled = false,
}: {
  reviewId: string;
  likeCount: number;
  isLiked: boolean;
  // While the screen shows a list's copy of the review, there's no detail
  // query entry yet for the optimistic update to write to.
  disabled?: boolean;
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
      disabled={pending || disabled}
      onPress={() =>
        isSignedIn ? (isLiked ? unlike.mutate() : like.mutate()) : router.push(ROUTES.SIGN_IN)
      }
      className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 active:opacity-80 ${
        isLiked ? "bg-black/60" : "bg-black/25"
      }`}
    >
      <Icon name={isLiked ? "heart" : "heart-outline"} size={16} className="text-paper" />
      <Text className="font-numeric text-lg leading-5 text-paper">{likeCount}</Text>
    </Pressable>
  );
}

// getById always hydrates these relations, so narrow them to required here.
// dj stays nullable: a review of the night as a whole has none.
type ReviewDetail = Review & {
  dj: Dj | null;
  taggedUsers: User[];
  user: User;
  likeCount: number;
  isLikedByMe: boolean;
};

// A review some list already loaded (feed, popular, a profile's or a DJ's/
// night's/series' reviews), so tapping its card opens the detail at once
// while the full fetch runs. Lists store reviews in different shapes (pages,
// items, recentReviews, …), so walk every cached reviews/feed/detail query
// for a review with this id. Profile lists omit `user`, so the reviewer is
// looked up from any cached user the walk passed.
function findCachedReview(queryClient: QueryClient, id: string): ReviewDetail | undefined {
  let found: Review | undefined;
  const users = new Map<string, User>();
  const walk = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.id === "string") {
      if (obj.id === id && "rating" in obj && "userId" in obj && !found) found = obj as unknown as Review;
      if (typeof obj.username === "string") users.set(obj.id, obj as unknown as User);
    }
    for (const child of Object.values(obj)) walk(child, depth + 1);
  };
  for (const prefix of ["feed", "reviews", "users", "djs", "events", "series"]) {
    for (const [, data] of queryClient.getQueriesData({ queryKey: [prefix] })) walk(data, 0);
  }
  if (!found) return undefined;
  const user = found.user ?? users.get(found.userId);
  if (!user) return undefined;
  // dj/event stay as the list had them; the screen guards both already.
  return {
    ...found,
    user,
    taggedUsers: found.taggedUsers ?? [],
    likeCount: found.likeCount ?? 0,
    isLikedByMe: found.isLikedByMe ?? false,
  } as ReviewDetail;
}

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
  const subject = reviewSubject(review);
  const djName = subject.name;
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
            {subject.imageUrl ? (
              <Image
                source={{ uri: subject.imageUrl }}
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
          {!!logWhere(review.log).length && (
            <Text style={{ fontSize: u(13), color: "#BA95E4", textAlign: "center", marginTop: u(4) }}>
              {logWhere(review.log).join(" · ")}
            </Text>
          )}
          <Text style={{ fontSize: u(12), color: "#A4A0B1", marginTop: u(2) }}>{seen}</Text>
          {!!review.rating && (
            <View style={{ marginTop: u(8) }}>
              <RatingStars value={review.rating} size={u(22)} />
            </View>
          )}

          {!!review.reviewText && (
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
          )}
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
  const [imageSettled, setImageSettled] = useState(!review.dj?.imageUrl);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const filename = `beatboxd-${review.dj?.slug ?? "night"}.png`;
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
      {justLogged && (
        <Text className="mb-3 text-center text-base text-ink dark:text-paper">
          Set logged! Let your followers know who you saw.
        </Text>
      )}
      <Button onPress={() => setOpen(true)} className="w-full flex-row gap-2 py-3">
        <Ionicons name="logo-instagram" size={18} color="#F6F6F9" />
        <Text className="font-semibold text-paper">Share to Instagram story</Text>
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open && <ShareStorySheet review={review} onClose={() => setOpen(false)} />}
      </Modal>
    </View>
  );
}

// Blank paper laid out like the detail card below: label, big name, event
// line, a few lines of text, and the reviewer/like row.
function ReviewDetailSkeleton({ tint }: { tint: string | undefined }) {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <View style={[contentStyle, { paddingTop: 24, alignItems: "center" }]}>
        <View className="w-full max-w-xl">
          <Card blank tint={paperFor(tint).tint} torn tilt={-0.6} className="pb-7">
            <View className="pr-24">
              <Skeleton tone="paper" className="h-4 w-44" />
              <Skeleton tone="paper" className="mt-3 h-14 w-56" />
              <Skeleton tone="paper" className="mt-2 h-5 w-40" />
            </View>
            <Skeleton tone="paper" className="mt-5 h-4 w-full" />
            <Skeleton tone="paper" className="mt-2.5 h-4 w-full" />
            <Skeleton tone="paper" className="mt-2.5 h-4 w-2/3" />
            <View className="mt-5 flex-row items-center justify-between border-t-2 border-black/15 pt-4">
              <View className="flex-row items-center gap-2">
                <Skeleton tone="paper" className="h-[30px] w-[30px] rounded-full" />
                <Skeleton tone="paper" className="h-4 w-32" />
              </View>
              <Skeleton tone="paper" className="h-8 w-14 rounded-lg" />
            </View>
          </Card>
        </View>
      </View>
    </Page>
  );
}

export default function ReviewDetailScreen() {
  const { id, justLogged, tint } = useLocalSearchParams<{ id: string; justLogged?: string; tint?: string }>();
  const api = useApi();
  const contentStyle = usePageContentStyle();
  const { me } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: review, isPlaceholderData } = useQuery({
    queryKey: queryKeys.reviews.byId(id!),
    queryFn: () => api.get<ReviewDetail>(`/reviews/${id}`),
    placeholderData: () => findCachedReview(queryClient, id!),
  });

  if (!review) {
    return <ReviewDetailSkeleton tint={tint} />;
  }
  const subject = reviewSubject(review);
  // The color of the card it was opened from (purple when opened from
  // anywhere else, like a notification or a shared link).
  const paper = paperFor(tint);

  return (
    <Page>
      <Stack.Screen options={{ title: subject.name }} />
      <KeyboardScrollView contentContainerStyle={[contentStyle, { paddingTop: 24, alignItems: "center" }]}>
        <View className="w-full max-w-xl">
          <Card tint={paper.tint} torn tilt={-0.6} className="pb-7">
            <Tape style={{ top: -10, left: 28 }} rotate={-4} />
            <View className="pr-24">
              <Text
                className={`font-display text-base uppercase ${paper.inkClassName}`}
              >
                {[formatCardDate(review.seenAt), review.log && formatEventTiming(review.log), subject.isNight && "Whole night"]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Link href={subject.href ?? ROUTES.REVIEW_DETAIL(review.id)} asChild>
                <Pressable className="mt-2 active:opacity-80">
                  <FitText fontSize={60} className="text-paper">
                    {subject.name}
                  </FitText>
                </Pressable>
              </Link>
              {/* The event (on a DJ review - a night review's title already
                  links there) and the venue, each to its own page. */}
              {!!review.log?.venue && (
                <Text className="mt-1 font-display text-xl uppercase leading-6 text-paper">
                  {!subject.isNight && !!review.log.event && (
                    <>
                      <Link href={ROUTES.EVENT(review.log.event.slug)}>
                        <Text className="underline">{review.log.event.name}</Text>
                      </Link>{" "}
                    </>
                  )}
                  @{" "}
                  {review.log.venueId ? (
                    <Link href={ROUTES.VENUE(review.log.venueId)}>
                      <Text className="underline">{review.log.venue}</Text>
                    </Link>
                  ) : (
                    review.log.venue
                  )}
                </Text>
              )}
            </View>
            <View className="absolute right-3 top-3">
              <RatingStamp value={review.rating} size={84} />
            </View>

            {review.reviewText && <Text className="mt-4 text-lg leading-7 text-paper">{review.reviewText}</Text>}

            {!!review.tags?.length && (
              <View className="mt-4">
                <ReviewTags tags={review.tags} />
              </View>
            )}

            {!!review.taggedUsers?.length && (
              <Text className="mt-3 font-display text-lg uppercase text-paper/85">
                With {review.taggedUsers.map((u) => `@${u.username}`).join(", ")}
              </Text>
            )}

            <View className="mt-5 flex-row items-center justify-between border-t-2 border-paper/25 pt-4">
              <Link href={ROUTES.USER(review.user.username)} asChild>
                <Pressable className="flex-row items-center gap-2 active:opacity-80">
                  <Avatar uri={review.user.avatarUrl} name={review.user.username} size={30} />
                  <Text className="font-display text-lg uppercase text-paper">@{review.user.username}</Text>
                </Pressable>
              </Link>
              <LikeButton
                reviewId={review.id}
                likeCount={review.likeCount}
                isLiked={review.isLikedByMe}
                disabled={isPlaceholderData}
              />
            </View>
          </Card>
        </View>

        {/* Story sharing hands the image to Instagram via the OS share sheet,
            which only works well from the native iOS app. */}
        {isIos && !isPlaceholderData && me?.id === review.userId && (
          <ShareStoryButton review={review} justLogged={justLogged === "1"} />
        )}

        <View className="w-full max-w-xl">
          <CommentSection reviewId={review.id} />
        </View>
      </KeyboardScrollView>
    </Page>
  );
}
