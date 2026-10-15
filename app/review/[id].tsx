import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useEffect, useRef, useState, type RefObject } from "react";

import {
  Avatar,
  Button,
  CARD_COLORS,
  Icon,
  KeyboardScrollView,
  paperFor,
  type Paper,
  RatingStamp,
  SectionTitle,
  Sheet,
  Skeleton,
  Tape,
  Text,
  TextField,
  TornEdge,
  usePageContentStyle,
  WallBackground,
} from "../../components/ui";
import { DetailPage } from "../../components/DetailPage";
import { ModerationButton } from "../../components/ModerationSheet";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { TagFriendsPicker } from "../../components/TagFriendsPicker";
import { useCurrentUser } from "../../lib/auth";
import { errorMessage, useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj, Review, ReviewComment, UpdateReviewInput, UpdateReviewResponse, User } from "../../lib/api/types";
import { nightDateParts, reviewSubject, soloSet } from "../../lib/review";
import { ROUTES } from "../../lib/routes";
import { captureStory, shareStory, WEB_URL, type CapturedStory } from "../../lib/shareStory";
import { isIos, isWeb } from "@/lib/utils";

// Every list a review's card might sit in (feed, profiles, DJ/event/venue
// pages), so a like or comment here shows up in the card's counts on the way
// back without refetching those lists.
const LIST_PREFIXES = ["feed", "reviews", "users", "djs", "events", "venues"];

function patchCachedReview(queryClient: QueryClient, id: string, patch: (review: Review) => Review) {
  const visit = (value: unknown, depth: number): unknown => {
    if (!value || typeof value !== "object" || depth > 6) return value;
    if (Array.isArray(value)) {
      const next = value.map((item) => visit(item, depth + 1));
      return next.some((item, i) => item !== value[i]) ? next : value;
    }
    const obj = value as Record<string, unknown>;
    if (obj.id === id && "rating" in obj && "userId" in obj) return patch(obj as unknown as Review);
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      next[key] = visit(child, depth + 1);
      if (next[key] !== child) changed = true;
    }
    return changed ? next : value;
  };
  for (const prefix of LIST_PREFIXES) {
    queryClient.setQueriesData({ queryKey: [prefix] }, (data: unknown) => visit(data, 0));
  }
}

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
  // The detail query and every list card both carry the count.
  const bumpCommentCount = (by: number) =>
    patchCachedReview(queryClient, reviewId, (review) => ({
      ...review,
      commentCount: Math.max(0, (review.commentCount ?? 0) + by),
    }));

  const addComment = useMutation({
    mutationFn: (input: { body: string }) => api.post<ReviewComment>(`/reviews/${reviewId}/comments`, input),
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
    mutationFn: (id: string) => api.del(`/comments/${id}`),
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
                <Text className="font-display text-base uppercase text-paper/80">@{comment.user?.username}</Text>
                <Text className="text-sm text-paper">{comment.body}</Text>
              </View>
            </View>
            {me?.id === comment.userId ? (
              <Pressable onPress={() => deleteComment.mutate(comment.id)}>
                <Text className="text-xs text-muted">Delete</Text>
              </Pressable>
            ) : (
              !!comment.user &&
              !comment.id.startsWith("temp-") && (
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

// The comment count beside the like button, from the loaded comments once
// there are any (same query as CommentSection, so no extra fetch).
function CommentCount({ reviewId, fallback }: { reviewId: string; fallback: number }) {
  const api = useApi();
  const { data: comments } = useQuery({
    queryKey: queryKeys.reviews.comments(reviewId),
    queryFn: () => api.get<ReviewComment[]>(`/reviews/${reviewId}/comments`),
  });
  return (
    <View className="flex-row items-center gap-1.5 rounded-lg bg-black/25 px-3 py-1.5">
      <Icon name="chatbubble-outline" size={15} className="text-paper" />
      <Text className="font-numeric text-lg leading-5 text-paper">{comments?.length ?? fallback}</Text>
    </View>
  );
}

// getById always includes who posted it, so narrow it to required here.
type ReviewDetail = Review & { user: User };

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
  return { ...found, user };
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

// The story card's photo: the subject's own, or for a night with several DJs
// (whose subject has none), the first one on the lineup with a photo.
function storyPhoto(review: ReviewDetail) {
  return (
    reviewSubject(review, soloSet(review)).imageUrl ??
    review.lineup.find((entry) => entry.dj.imageUrl)?.dj.imageUrl ??
    null
  );
}

// The 9:16 Instagram story image, in the app's zine look: a torn, taped
// paper card (the same purple/red the review was opened on) pinned to the
// concrete wall, with a framed snapshot and the rating stamp. Laid out on a
// 360-wide design grid and scaled by `width` so the on-screen preview and the
// 1080×1920 capture are the same drawing. Key content stays clear of the top
// ~10% / bottom ~12%, where Instagram overlays its progress bar, header and
// reply box. Shadows are native-only extras; web capture via html2canvas
// drops them.
function StoryCard({
  review,
  paper,
  width,
  cardRef,
  onImageSettled,
}: {
  review: ReviewDetail;
  paper: Paper;
  width: number;
  cardRef: RefObject<View | null>;
  onImageSettled: () => void;
}) {
  const u = (n: number) => (n * width) / 360;
  const height = (width * 16) / 9;
  // A post that's just one DJ's review (see soloSet) shares as that DJ's.
  const set = soloSet(review);
  const subject = reviewSubject(review, set);
  const photo = storyPhoto(review);
  const rating = set ? set.rating : review.rating;
  const reviewText = set ? set.reviewText : review.reviewText;
  const paperColor = CARD_COLORS[paper.tint];
  const label = nightDateParts(review, { wholeNight: subject.isNight, withYear: true }).join(" · ");
  const where = review.venue
    ? `${!subject.isNight && review.event ? `${review.event.name} ` : ""}@ ${review.venue}`
    : null;
  const nameSize = subject.name.length > 22 ? 34 : subject.name.length > 12 ? 42 : 54;
  const tags = review.tags?.slice(0, 3) ?? [];

  return (
    <View ref={cardRef} collapsable={false} style={{ width, height, overflow: "hidden", backgroundColor: "#000000" }}>
      <WallBackground />

      <View
        style={{
          flex: 1,
          paddingTop: u(62),
          paddingBottom: u(82),
          paddingHorizontal: u(26),
          justifyContent: "space-between",
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: u(8) }}>
            <Image source={require("../../assets/logo-mark.png")} style={{ width: u(34), height: u(34) }} />
            <Text
              className="font-display text-paper"
              style={{
                fontSize: u(38),
                lineHeight: u(40),
                textShadowColor: "rgba(255,255,255,0.35)",
                textShadowRadius: u(8),
              }}
            >
              BeatBox&apos;d
            </Text>
          </View>
          <Text
            className="font-display uppercase text-paper/75"
            style={{ fontSize: u(17), lineHeight: u(20), marginTop: u(4) }}
          >
            @{review.user.username} caught
          </Text>
        </View>

        {/* The paper card, tilted like it's tacked to the wall. */}
        <View
          style={{
            transform: [{ rotate: "-1.5deg" }],
            shadowColor: "#000",
            shadowOpacity: 0.6,
            shadowRadius: u(10),
            shadowOffset: { width: 0, height: u(6) },
          }}
        >
          <View style={{ backgroundColor: paperColor, padding: u(16), paddingBottom: u(20) }}>
            <TornEdge color={paperColor} height={u(10)} />
            <Tape style={{ top: -u(11), left: u(24) }} width={u(84)} rotate={-5} />

            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View
                style={{
                  width: u(122),
                  height: u(122),
                  borderWidth: u(4),
                  borderColor: "#F6F6F9",
                  overflow: "hidden",
                  transform: [{ rotate: "-3deg" }],
                }}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    onLoad={onImageSettled}
                    onError={onImageSettled}
                    resizeMode="cover"
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <View
                    className={`flex-1 items-center justify-end overflow-hidden ${paper.photoPlaceholderClassName}`}
                  >
                    <Icon name="person" size={u(110)} className={paper.photoSilhouetteClassName} />
                  </View>
                )}
              </View>
              {!!rating && (
                <View style={{ marginTop: u(4), marginRight: u(2) }}>
                  <RatingStamp value={rating} size={u(104)} rotate={-10} />
                </View>
              )}
            </View>

            <Text
              className={`font-display uppercase ${paper.inkClassName}`}
              style={{ fontSize: u(16), lineHeight: u(18), marginTop: u(16) }}
            >
              {label}
            </Text>
            <Text
              className="font-display uppercase text-paper"
              style={{ fontSize: u(nameSize), lineHeight: u(nameSize * 0.92), marginTop: u(4) }}
            >
              {subject.name}
            </Text>
            {!!where && (
              <Text
                className="font-display uppercase text-paper"
                style={{ fontSize: u(19), lineHeight: u(21), marginTop: u(2) }}
              >
                {where}
              </Text>
            )}

            {!!reviewText && (
              <Text className="text-paper" style={{ fontSize: u(14), lineHeight: u(20), marginTop: u(12) }}>
                “{snippet(reviewText, 140)}”
              </Text>
            )}

            {!!tags.length && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: u(6), marginTop: u(12) }}>
                {tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      borderWidth: u(2),
                      borderColor: "rgba(246,246,249,0.9)",
                      paddingHorizontal: u(6),
                      paddingVertical: u(1),
                    }}
                  >
                    <Text className="font-display uppercase text-paper" style={{ fontSize: u(14), lineHeight: u(16) }}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Call to action on a scrap of the near-black panel. */}
        <View
          style={{
            alignSelf: "center",
            alignItems: "center",
            marginTop: u(28),
            transform: [{ rotate: "1.5deg" }],
            backgroundColor: CARD_COLORS.neutral,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
            paddingHorizontal: u(18),
            paddingVertical: u(10),
          }}
        >
          <Text className="font-display uppercase text-paper" style={{ fontSize: u(22), lineHeight: u(24) }}>
            Log the sets you&apos;ve seen
          </Text>
          <Text
            className="font-display uppercase text-primary-dark"
            style={{ fontSize: u(15), lineHeight: u(17), marginTop: u(2) }}
          >
            {WEB_URL.replace(/^https?:\/\//, "")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ShareStorySheet({ review, paper, onClose }: { review: ReviewDetail; paper: Paper; onClose: () => void }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // A multiple of 9 keeps the 9:16 height a whole number of pixels.
  const previewWidth = Math.floor(Math.min(297, windowWidth - 64, ((windowHeight - 280) * 9) / 16) / 9) * 9;
  const cardRef = useRef<View>(null);
  const prepared = useRef<CapturedStory | null>(null);
  const set = soloSet(review);
  const [imageSettled, setImageSettled] = useState(!storyPhoto(review));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const filename = `beatboxd-${set?.dj.slug ?? "night"}.png`;
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
    } catch (err) {
      setNotice(errorMessage(err, "Couldn't create the image"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={onClose} className="flex-1 items-center justify-center bg-ink/70 px-4">
      <Pressable onPress={(e) => e.stopPropagation()} className="items-center rounded-2xl p-5 bg-surface-dark">
        <Text className="text-lg font-display text-paper">Share to your story</Text>
        <View className="mt-3 overflow-hidden rounded-xl">
          <StoryCard
            review={review}
            paper={paper}
            width={previewWidth}
            cardRef={cardRef}
            onImageSettled={() => setImageSettled(true)}
          />
        </View>
        <Text className="mt-3 text-center text-xs text-muted" style={{ maxWidth: previewWidth + 40 }}>
          {notice ?? "We'll copy a link to this review too — paste it into a Link sticker so friends can tap through."}
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
            <Text className="font-semibold text-paper">Done</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

function ShareStoryButton({ review, paper, justLogged }: { review: ReviewDetail; paper: Paper; justLogged: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View
      className={`w-full max-w-xl items-center gap-3 rounded-2xl p-4 ${
        justLogged ? "border border-accent/40 bg-accent/10" : ""
      }`}
    >
      {justLogged && (
        <Text className="text-center text-base text-paper">Set logged! Let your followers know who you saw.</Text>
      )}
      <Button onPress={() => setOpen(true)} className="w-full flex-row gap-2 py-3">
        <Ionicons name="logo-instagram" size={18} color="#F6F6F9" />
        <Text className="font-semibold text-paper">Share to Instagram story</Text>
      </Button>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open && <ShareStorySheet review={review} paper={paper} onClose={() => setOpen(false)} />}
      </Modal>
    </View>
  );
}

// Shown to someone tagged in this night who hasn't logged it themselves:
// one tap opens the log tab filled in with the night.
function LogItTooPrompt({ review }: { review: ReviewDetail }) {
  return (
    <View className="w-full max-w-xl items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <Text className="text-center text-base text-paper">
        @{review.user.username} tagged you here. Log the night and rate the sets you caught.
      </Text>
      <Button onPress={() => router.push(ROUTES.REVIEW_FROM(review.id))} className="w-full py-3">
        <Text className="font-semibold text-paper">Log this night</Text>
      </Button>
    </View>
  );
}

// A review is fixed once it's logged, except for who you tagged as being there
// with you: this opens a sheet to change that.
function WhoWasThereButton({ review }: { review: ReviewDetail }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tagged, setTagged] = useState<User[]>(review.taggedUsers);
  const save = useMutation({
    mutationFn: (input: UpdateReviewInput) => api.patch<UpdateReviewResponse>(`/reviews/${review.id}`, input),
    onSuccess: ({ taggedUsers }) => {
      patchCachedReview(queryClient, review.id, (r) => ({ ...r, taggedUsers }));
      setOpen(false);
    },
  });

  const openSheet = () => {
    setTagged(review.taggedUsers);
    save.reset();
    setOpen(true);
  };
  const hasTagged = !!review.taggedUsers.length;

  return (
    <>
      <Pressable
        onPress={openSheet}
        className="flex-row items-center justify-center gap-2 self-center border border-dashed border-paper/60 px-4 py-2 active:opacity-70"
      >
        <Icon name="people-outline" size={16} className="text-paper" />
        <Text className="font-display text-lg uppercase leading-5 text-paper">
          {hasTagged ? "Edit who was there" : "Tag who was there"}
        </Text>
      </Pressable>
      {open && (
        <Sheet title="Who was there?" tag="With you" onClose={() => setOpen(false)}>
          <View className="gap-4 px-4">
            <Text className="text-xs text-paper/60">
              Your log is pinned to the wall. Who you went with is the one thing you can still change.
            </Text>
            <TagFriendsPicker
              taggedUsers={tagged}
              startTyping={!tagged.length}
              onAdd={(user) => setTagged((prev) => [...prev, user])}
              onRemoveTaggedUser={(userId) => setTagged((prev) => prev.filter((u) => u.id !== userId))}
            />
            {save.isError && (
              <Text className="text-danger-dark">{(save.error as Error)?.message ?? "Could not save. Try again."}</Text>
            )}
            <Button
              disabled={save.isPending}
              onPress={() => save.mutate({ taggedUserIds: tagged.map((u) => u.id) })}
              className="py-3"
            >
              <Text className="font-display text-xl uppercase text-paper">{save.isPending ? "Saving…" : "Save"}</Text>
            </Button>
          </View>
        </Sheet>
      )}
    </>
  );
}

// Deletes the whole night out, with every DJ review in it.
function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.del(`/reviews/${reviewId}`),
    onSuccess: () => {
      for (const prefix of LIST_PREFIXES) queryClient.invalidateQueries({ queryKey: [prefix] });
      if (router.canGoBack()) router.back();
      else router.replace(ROUTES.FEED);
    },
    onError: (err) => {
      const message = errorMessage(err, "Please try again.");
      if (isWeb) window.alert(`Could not delete review. ${message}`);
      else Alert.alert("Could not delete review", message);
    },
  });

  const onPress = () => {
    if (isWeb) {
      if (window.confirm("Delete this review? This can't be undone.")) remove.mutate();
      return;
    }
    Alert.alert("Delete review", "This deletes your review of the night and every DJ in it. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate() },
    ]);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={remove.isPending}
      className="flex-row items-center gap-1.5 self-center px-3 py-2 active:opacity-70"
    >
      {remove.isPending ? (
        <ActivityIndicator size="small" color="#F6F6F9" />
      ) : (
        <Icon name="trash-outline" size={16} className="text-paper/60" />
      )}
      <Text className="font-display text-lg uppercase text-paper/60">Delete review</Text>
    </Pressable>
  );
}

// Space above the review card: more than a plain page's, since the card's
// tape pokes up above it.
const REVIEW_TOP = 36;

function ReviewDetailSkeleton({ tint }: { tint: string | undefined }) {
  const contentStyle = usePageContentStyle("roomy");
  return (
    <View style={[contentStyle, { paddingTop: REVIEW_TOP, alignItems: "center" }]}>
      <View className="w-full max-w-xl">
        <ReviewCardSkeleton paper={paperFor(tint)} />
      </View>
    </View>
  );
}

// Titled after the night, or the DJ when it's just their review.
function reviewTitle(review: ReviewDetail): string {
  return reviewSubject(review, soloSet(review)).name;
}

export default function ReviewDetailScreen() {
  const { id, justLogged, tint } = useLocalSearchParams<{ id: string; justLogged?: string; tint?: string }>();
  const api = useApi();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.reviews.byId(id ?? ""),
    queryFn: () => api.get<ReviewDetail>(`/reviews/${id}`),
    placeholderData: () => findCachedReview(queryClient, id ?? ""),
    enabled: !!id,
  });

  return (
    <DetailPage
      underHeader
      query={query}
      title={reviewTitle}
      skeleton={<ReviewDetailSkeleton tint={tint} />}
      missing="This review has been deleted."
    >
      {(review) => (
        <ReviewDetailBody
          review={review}
          isPlaceholderData={query.isPlaceholderData}
          // The color of the card it was opened from (purple when opened
          // from anywhere else, like a notification or a shared link).
          paper={paperFor(tint)}
          justLogged={justLogged === "1"}
        />
      )}
    </DetailPage>
  );
}

function ReviewDetailBody({
  review,
  isPlaceholderData,
  paper,
  justLogged,
}: {
  review: ReviewDetail;
  isPlaceholderData: boolean;
  paper: Paper;
  justLogged: boolean;
}) {
  const contentStyle = usePageContentStyle("roomy");
  const { me } = useCurrentUser();

  return (
    <KeyboardScrollView contentContainerStyle={[contentStyle, { paddingTop: REVIEW_TOP, alignItems: "center" }]}>
      <View className="w-full max-w-xl">
        <ReviewCard
          review={review}
          index={0}
          paper={paper}
          expanded
          actions={
            <View className="flex-row items-center gap-2">
              <LikeButton
                reviewId={review.id}
                likeCount={review.likeCount}
                isLiked={review.isLikedByMe}
                disabled={isPlaceholderData}
              />
              <CommentCount reviewId={review.id} fallback={review.commentCount} />
            </View>
          }
        />
      </View>

      {/* Clear of the torn edge and rating stamp hanging off the card. */}
      <View className="mt-14 w-full items-center gap-4">
        {!isPlaceholderData && me?.id === review.userId && <WhoWasThereButton review={review} />}

        {!isPlaceholderData && review.viewerLoggedNight === false && <LogItTooPrompt review={review} />}

        {/* Story sharing hands the image to Instagram via the OS share sheet,
            which only works well from the native iOS app. */}
        {isIos && !isPlaceholderData && me?.id === review.userId && (
          <ShareStoryButton review={review} paper={paper} justLogged={justLogged} />
        )}

        <View className="mt-4 w-full max-w-xl gap-4">
          <CommentSection reviewId={review.id} />
          {!isPlaceholderData && me?.id === review.userId && <DeleteReviewButton reviewId={review.id} />}
          {!isPlaceholderData && me?.id !== review.userId && !!review.user && (
            <ModerationButton user={review.user} target={{ reviewId: review.id }} label="Report or block" />
          )}
        </View>
      </View>
    </KeyboardScrollView>
  );
}
