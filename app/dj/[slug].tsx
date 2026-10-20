import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  Card,
  CardSeparator,
  EmptyState,
  FadeInView,
  FitText,
  Icon,
  LoadingFade,
  paperAt,
  Photo,
  SectionTitle,
  Skeleton,
  Stamp,
  Text,
  TornEdge,
  CARD_COLORS,
  tiltFor,
  useIsDesktopWeb,
  usePageContentStyle,
  usePageGutter,
} from "@/components/ui";
import { DetailPage } from "@/components/DetailPage";
import { NightStamp } from "@/components/NightStamp";
import { ReviewTags } from "@/components/ReviewTags";
import { useDjDetail } from "@/lib/api/hooks";
import { plural } from "@/lib/format";
import type { DjDetail, Review } from "@/lib/api/types";
import { getNightTitle, nightDateParts } from "@/lib/review";
import { ROUTES } from "@/lib/routes";
import { colors } from "@/lib/colors";

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
    <View className="pr-28">
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
          <Text variant="display" className="text-lg text-zine-red-ink">
            {expanded ? "Show less" : "Read more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Spotify's icon (via Simple Icons). Their branding rules require the
// official mark next to anything shown from their API (the photo and
// genres), linking back to the artist on Spotify.
const SPOTIFY_ICON_PATH =
  "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z";

function SpotifyLink({ spotifyId }: { spotifyId: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(`https://open.spotify.com/artist/${spotifyId}`)}
      accessibilityRole="link"
      className="mt-3 flex-row items-center gap-2 self-start active:opacity-70"
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d={SPOTIFY_ICON_PATH} fill={colors.paper} />
      </Svg>
      <Text variant="display" className="text-lg text-paper">
        Listen on Spotify
      </Text>
    </Pressable>
  );
}

function NameBand({ data }: { data: DjDetail }) {
  const gutter = usePageGutter();
  return (
    <View className="z-10 bg-zine-red pb-8 pt-4" style={{ paddingHorizontal: gutter }}>
      <FitText fontSize={72} numberOfLines={3} className="text-paper">
        {data.dj.name}
      </FitText>
      {!!data.dj.genres?.length && (
        <Text variant="display" className="mt-2 text-xl text-zine-red-ink">
          {data.dj.genres.slice(0, 3).join(" · ")}
        </Text>
      )}
      {!!data.dj.bio && (
        <>
          <View className="mt-2" />
          <DjBio bio={data.dj.bio} />
        </>
      )}
      {!!data.dj.spotifyId && <SpotifyLink spotifyId={data.dj.spotifyId} />}
      <TornEdge color={CARD_COLORS.accent} height={12} />
      <View className="absolute -bottom-12" style={{ right: gutter - 8 }}>
        <Stamp
          label={String(data.timesSeen)}
          rim="SEEN · BEATBOXD · "
          size={124}
          color="purple"
          rotate={-4}
          accessibilityLabel={`Seen ${plural(data.timesSeen, "time")}`}
        />
      </View>
    </View>
  );
}

// A night the DJ was on the lineup of: what the reviewer said about the
// DJ's set, or - when they only wrote about the night as a whole - the
// night's.
function DjNightRow({ review, djId, index }: { review: Review; djId: string; index: number }) {
  const where = getNightTitle(review);
  const set = review.lineup.find((entry) => entry.dj.id === djId && !!entry.reviewText);
  const reviewText = set ? set.reviewText : review.reviewText;
  const meta = [...(review.user ? [`@${review.user.username}`] : []), ...nightDateParts(review, { wholeNight: !set })];
  const paper = paperAt(index);
  return (
    <Card href={ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })} tint={paper.tint} tilt={tiltFor(review.id, 0.8)}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text variant="display" className="text-3xl leading-8 text-paper" numberOfLines={1}>
            {where}
          </Text>
          <Text variant="display" className={`text-base ${paper.inkClassName}`}>
            {meta.join(" · ")}
          </Text>
        </View>
        <NightStamp review={review} size={52} />
      </View>
      {!!reviewText && (
        <Text className="mt-2 text-base leading-6 text-paper" numberOfLines={4}>
          {reviewText}
        </Text>
      )}
      {!!review.tags.length && (
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
    <>
      <Hero imageUrl={null} showBack={!isDesktopWeb} />
      <LoadingFade className="bg-zine-red/30 pb-8 pt-4" style={{ paddingHorizontal: gutter }}>
        <Skeleton tone="paper" className="h-16 w-56" />
        <Skeleton tone="paper" className="mt-3 h-5 w-40" />
        <Skeleton tone="paper" className="mt-3 h-4 w-3/4" />
      </LoadingFade>
      <View style={contentStyle}>
        <Skeleton className="mt-10 h-40 w-full rounded-none" />
      </View>
    </>
  );
}

export default function DjProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useDjDetail(slug);
  const isDesktopWeb = useIsDesktopWeb();

  // Desktop web keeps its top navbar (the stack header); phones lose the
  // header so the photo runs full-bleed, with a floating back key instead.
  // The not-found state keeps the header, for its back button.
  const fullBleed = !isDesktopWeb && !query.error;
  return (
    <DetailPage
      fullBleed={fullBleed}
      screenOptions={{ headerShown: !fullBleed }}
      query={query}
      title={(data) => data.dj.name}
      skeleton={<DjProfileSkeleton />}
      missing="This DJ isn't on Beatboxd."
    >
      {(data) => <DjProfileList data={data} />}
    </DetailPage>
  );
}

function DjProfileList({ data }: { data: DjDetail }) {
  const contentStyle = usePageContentStyle();
  const isDesktopWeb = useIsDesktopWeb();

  return (
    <FlatList
      data={data.recentReviews}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Hero imageUrl={data.dj.imageUrl} showBack={!isDesktopWeb} />
          <FadeInView className="z-10">
            <NameBand data={data} />
          </FadeInView>
          <View style={[contentStyle, { paddingTop: 72, paddingBottom: 0 }]} className="gap-4">
            <SectionTitle>Recent logs</SectionTitle>
          </View>
          <View className="h-2" />
        </>
      }
      renderItem={({ item, index }) => (
        <View style={{ paddingHorizontal: contentStyle.paddingHorizontal }}>
          <DjNightRow review={item} djId={data.dj.id} index={index} />
        </View>
      )}
      ItemSeparatorComponent={CardSeparator}
      ListFooterComponent={<View style={{ height: contentStyle.paddingBottom }} />}
      ListEmptyComponent={
        <View className="mt-2" style={{ paddingHorizontal: contentStyle.paddingHorizontal }}>
          <EmptyState message="No logs yet for this DJ." />
        </View>
      }
    />
  );
}
