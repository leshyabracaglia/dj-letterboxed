import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Button, KeyboardScrollView, paperFor, type Paper, Text, usePageContentStyle } from "@/components/ui";
import { DetailPage } from "@/components/DetailPage";
import { ModerationButton } from "@/components/ModerationSheet";
import { ReviewCard, ReviewCardSkeleton } from "@/components/ReviewCard";
import { AddToListButton } from "@/components/review/AddToListButton";
import { CommentCount, CommentSection } from "@/components/review/Comments";
import { LikeButton } from "@/components/review/LikeButton";
import { DeleteReviewButton, WhoWasThereButton } from "@/components/review/OwnerActions";
import { ShareStoryButton } from "@/components/review/ShareStoryButton";
import { TrackIdRequest } from "@/components/review/TrackIdRequest";
import { findCachedReview } from "@/lib/api/cache";
import { useApi, unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queryKeys";
import type { Review, ReviewDetail } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { isIos } from "@/lib/platform";
import { reviewSubject, soloSet } from "@/lib/review";
import { ROUTES } from "@/lib/routes";

// Shown to someone tagged in this night who hasn't logged it themselves:
// one tap opens the log tab filled in with the night.
function LogItTooPrompt({ review }: { review: ReviewDetail }) {
  return (
    <View className="w-full max-w-xl items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <Text className="text-center text-base text-paper">
        @{review.user.username} tagged you here. Log the night and the sets you caught.
      </Text>
      <Button onPress={() => router.push(ROUTES.REVIEW_FROM(review.id))} className="w-full py-3">
        <Text className="font-semibold text-paper">Log this night</Text>
      </Button>
    </View>
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

// A review fetched by id always says who posted it (only lists leave that
// off), so the page can count on it.
function withAuthor(review: Review): ReviewDetail {
  if (!review.user) throw new Error("This review is missing who posted it.");
  return { ...review, user: review.user };
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
    queryFn: id ? () => unwrap(api.GET("/api/reviews/{id}", { params: { path: { id } } })).then(withAuthor) : skipToken,
    placeholderData: () => findCachedReview(queryClient, id ?? ""),
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
  // A list's copy of the review shows at once, but what you can do with it
  // waits for the real one.
  const loaded = !isPlaceholderData;
  const isAuthor = loaded && me?.id === review.userId;
  const isSomeoneElses = loaded && me?.id !== review.userId;

  return (
    <KeyboardScrollView contentContainerStyle={[contentStyle, { paddingTop: REVIEW_TOP, alignItems: "center" }]}>
      <View className="w-full max-w-xl">
        <ReviewCard
          review={review}
          index={0}
          paper={paper}
          expanded
          trackExtra={(track) => loaded && <TrackIdRequest review={review} track={track} />}
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

      {/* Clear of the torn edge and passport stamp hanging off the card. */}
      <View className="mt-14 w-full items-center gap-4">
        {isAuthor && <WhoWasThereButton review={review} />}
        {loaded && !!me && <AddToListButton review={review} />}

        {loaded && review.viewerLoggedNight === false && <LogItTooPrompt review={review} />}

        {/* Story sharing hands the image to Instagram via the OS share sheet,
            which only works well from the native iOS app. */}
        {isIos && isAuthor && <ShareStoryButton review={review} paper={paper} justLogged={justLogged} />}

        <View className="mt-4 w-full max-w-xl gap-4">
          <CommentSection reviewId={review.id} />
          {isAuthor && <DeleteReviewButton reviewId={review.id} />}
          {isSomeoneElses && (
            <ModerationButton user={review.user} target={{ reviewId: review.id }} label="Report or block" />
          )}
        </View>
      </View>
    </KeyboardScrollView>
  );
}
