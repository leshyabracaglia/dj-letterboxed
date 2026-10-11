import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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

const BIO_LINES = 3;
const BIO_LINE_HEIGHT = 24; // leading-6

// The bio clamped to a few lines, with a "Read more" toggle when it runs
// longer. Overflow is found by measuring an invisible unclamped copy, since
// onTextLayout doesn't fire on web.
function DjBio({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  return (
    <View className="mt-2 pr-28">
      <View>
        <Text
          className="pointer-events-none absolute left-0 right-0 text-base leading-6 text-paper opacity-0"
          onLayout={(e) => setOverflows(e.nativeEvent.layout.height > BIO_LINES * BIO_LINE_HEIGHT + 1)}
          aria-hidden
        >
          {bio}
        </Text>
        <Text className="text-base leading-6 text-paper" numberOfLines={expanded ? undefined : BIO_LINES}>
          {bio}
        </Text>
      </View>
      {overflows && (
        <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8} className="mt-1 self-start active:opacity-70">
          <Text className="font-display text-lg uppercase text-zine-red-ink">
            {expanded ? "Show less" : "Read more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

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
      {!!data.dj.bio && <DjBio bio={data.dj.bio} />}
      <TornEdge color={CARD_COLORS.accent} height={12} />
      <View className="absolute -bottom-12" style={{ right: gutter - 8 }}>
        <RatingStamp value={avgRating} size={124} color="purple" rotate={-4} />
      </View>
    </View>
  );
}

function RatingLevels({ counts, reviewCount }: { counts: number[]; reviewCount: number }) {
  const max = Math.max(1, ...counts);
  return (
    <Card tilt={0.6} className="bg-zine-panel">
      <View className="mb-3 flex-row justify-between">
        <Text className="font-display text-xl uppercase text-paper/70">Rating levels</Text>
        <Text className="font-display text-xl uppercase text-paper/70">Avg of {reviewCount}</Text>
      </View>
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = counts[stars - 1] ?? 0;
        return (
          <View key={stars} className="mb-2 flex-row items-center gap-3">
            <Text className="w-4 font-display text-lg text-paper">{stars}</Text>
            <View className="h-3 flex-1 bg-[#2A0F14]">
              {!!count && (
                <View className="h-full bg-paper shadow-md shadow-white" style={{ width: `${(count / max) * 100}%` }} />
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function LogRow({ review, index }: { review: Review; index: number }) {
  const where = review.log?.event?.name || review.log?.venue || "A night out";
  const meta = [
    review.user && `@${review.user.username}`,
    formatCardDate(review.seenAt),
    review.log && formatEventTiming(review.log),
    // A night they played that was only rated as a whole: the stamp is the
    // night's rating, not theirs.
    !review.djId && "Whole night",
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
