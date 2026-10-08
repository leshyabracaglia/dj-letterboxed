import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  EmptyState,
  FadeInView,
  FitText,
  Icon,
  LoadingFade,
  Page,
  paperAt,
  Photo,
  RatingStamp,
  Skeleton,
  Text,
  TornEdge,
  CARD_COLORS,
  tiltFor,
  useIsDesktopWeb,
  usePageContentStyle,
  usePageGutter,
} from "../../components/ui";
import { ReviewTags } from "../../components/ReviewTags";
import { useDjDetail } from "../../lib/api/hooks";
import type { DjDetail, Review } from "../../lib/api/types";
import { formatCardDate, formatEventTiming } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

const HERO_HEIGHT = 280;

// Floating square back key over the hero (the stack header is hidden here so
// the photo can run to the top of the screen).
function BackButton() {
  const { top } = useSafeAreaInsets();
  const gutter = usePageGutter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(ROUTES.BROWSE))}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      className="absolute z-10 h-14 w-14 items-center justify-center rounded-xl bg-black/85 active:opacity-80"
      style={{ top: top + 12, left: gutter }}
    >
      <Icon name="chevron-back" size={24} className="text-paper" />
    </Pressable>
  );
}

function Hero({ imageUrl, showBack }: { imageUrl: string | null; showBack: boolean }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ height: HERO_HEIGHT + top }}>
      <LinearGradient colors={["#2E1A55", "#4B2E84"]} style={StyleSheet.absoluteFill} />
      <Photo uri={imageUrl} placeholderClassName="bg-transparent" silhouetteClassName="text-[#5B4A99]" />
      {showBack && <BackButton />}
    </View>
  );
}

// Red band under the photo: name, genres, bio, and the average stamped over
// its torn bottom edge.
function NameBand({ data }: { data: DjDetail }) {
  const gutter = usePageGutter();
  const avgRating = data.avgRating ? Number(data.avgRating) : null;
  return (
    <View className="z-10 bg-zine-red pb-8 pt-4" style={{ paddingHorizontal: gutter }}>
      <FitText fontSize={72} numberOfLines={3} className="text-paper">
        {data.dj.name}
      </FitText>
      {!!data.dj.genres?.length && (
        <Text className="mt-2 font-display text-xl uppercase text-zine-red-ink">
          {data.dj.genres.slice(0, 3).join(" · ")}
        </Text>
      )}
      {!!data.dj.bio && <Text className="mt-2 pr-28 text-base leading-6 text-paper">{data.dj.bio}</Text>}
      <TornEdge color={CARD_COLORS.accent} height={12} />
      <View className="absolute -bottom-12" style={{ right: gutter - 8 }}>
        <RatingStamp value={avgRating} size={124} color="purple" rotate={-4} />
      </View>
    </View>
  );
}

// How the DJ's reviews spread over 5..1 stars, as glowing bars.
function RatingLevels({ counts, reviewCount }: { counts: number[]; reviewCount: number }) {
  const max = Math.max(1, ...counts);
  return (
    <Card tilt={0.6} className="bg-zine-panel">
      <View className="mb-3 flex-row justify-between">
        <Text className="font-display text-xl uppercase text-paper/70">Rating levels</Text>
        <Text className="font-display text-xl uppercase text-paper/70">
          Avg of {reviewCount}
        </Text>
      </View>
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = counts[stars - 1] ?? 0;
        return (
          <View key={stars} className="mb-2 flex-row items-center gap-3">
            <Text className="w-4 font-display text-lg text-paper">{stars}</Text>
            <View className="h-3 flex-1 bg-[#2A0F14]">
              {!!count && (
                <View
                  className="h-full bg-paper shadow-md shadow-white"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

// One review of this DJ as a paper strip, purple and red alternating: the night, who logged it and when,
// then what they wrote and their tags.
function LogRow({ review, index }: { review: Review; index: number }) {
  const where = review.log?.event?.name || review.log?.venue || "A night out";
  const meta = [
    review.user && `@${review.user.username}`,
    formatCardDate(review.seenAt),
    review.log && formatEventTiming(review.log),
  ].filter(Boolean);
  const paper = paperAt(index);
  return (
    <Card href={ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })} tint={paper.tint} tilt={tiltFor(review.id, 0.8)}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-display text-3xl uppercase leading-8 text-paper" numberOfLines={1}>
            {where}
          </Text>
          <Text className={`font-display text-base uppercase ${paper.inkClassName}`}>{meta.join(" · ")}</Text>
        </View>
        <RatingStamp value={review.rating} size={52} />
      </View>
      {!!review.reviewText && (
        <Text className="mt-2 text-base leading-6 text-paper" numberOfLines={4}>
          {review.reviewText}
        </Text>
      )}
      {!!review.tags?.length && (
        <View className="mt-3">
          <ReviewTags tags={review.tags} limit={3} />
        </View>
      )}
    </Card>
  );
}

function DjProfileSkeleton() {
  const contentStyle = usePageContentStyle();
  const gutter = usePageGutter();
  const isDesktopWeb = useIsDesktopWeb();
  return (
    <Page fullBleed={!isDesktopWeb}>
      <Hero imageUrl={null} showBack={!isDesktopWeb} />
      <LoadingFade className="bg-zine-red/30 pb-8 pt-4" style={{ paddingHorizontal: gutter }}>
        <Skeleton tone="paper" className="h-16 w-56" />
        <Skeleton tone="paper" className="mt-3 h-5 w-40" />
        <Skeleton tone="paper" className="mt-3 h-4 w-3/4" />
      </LoadingFade>
      <View style={contentStyle}>
        <Skeleton className="mt-10 h-40 w-full rounded-none" />
      </View>
    </Page>
  );
}

export default function DjProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data } = useDjDetail(slug);
  const contentStyle = usePageContentStyle();
  const isDesktopWeb = useIsDesktopWeb();

  // Desktop web keeps its top navbar (the stack header); phones lose the
  // header so the photo runs full-bleed, with a floating back key instead.
  const screenOptions = { headerShown: isDesktopWeb, title: data?.dj.name };

  if (!data) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <DjProfileSkeleton />
      </>
    );
  }

  return (
    <Page fullBleed={!isDesktopWeb}>
      <Stack.Screen options={screenOptions} />
      <FlatList
        data={data.recentReviews}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <Hero imageUrl={data.dj.imageUrl} showBack={!isDesktopWeb} />
            <FadeInView className="z-10">
              <NameBand data={data} />
            </FadeInView>
            <View style={[contentStyle, { paddingTop: 72, paddingBottom: 0 }]}>
              <RatingLevels counts={data.ratingCounts} reviewCount={data.reviewCount} />
              <Text className="mb-3 mt-4 font-display text-2xl uppercase text-paper/85">Recent logs</Text>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: contentStyle.paddingHorizontal }}>
            <LogRow review={item} index={index} />
          </View>
        )}
        ListFooterComponent={<View style={{ height: contentStyle.paddingBottom }} />}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: contentStyle.paddingHorizontal }}>
            <EmptyState message="No logs yet for this DJ." className="mt-2 text-paper/60" />
          </View>
        }
      />
    </Page>
  );
}
