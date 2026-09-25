import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";

import {
  Avatar,
  EmptyState,
  GenreTags,
  Page,
  PageHeader,
  RatingStars,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { useDjDetail } from "../../lib/api/hooks";
import { formatRating } from "../../lib/format";

function DjProfileSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <PageHeader border="primary">
        <View className="flex-row items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <View className="flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-40" />
          </View>
        </View>
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-3/4" />
      </PageHeader>
      <View style={contentStyle}>
        <ReviewCardSkeleton count={3} />
      </View>
    </Page>
  );
}

export default function DjProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data } = useDjDetail(slug);
  const contentStyle = usePageContentStyle();

  if (!data) {
    return <DjProfileSkeleton />;
  }

  const avgRating = data.avgRating ? Number(data.avgRating) : null;

  return (
    <Page>
      <Stack.Screen options={{ title: data.dj.name }} />
      <PageHeader border="primary">
        <View className="flex-row items-center gap-3">
          <Avatar uri={data.dj.imageUrl} name={data.dj.name} size={64} />
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink dark:text-paper">{data.dj.name}</Text>
            <View className="mt-1 flex-row items-center gap-2">
              <RatingStars value={avgRating} size={16} />
              <Text className="text-muted">
                <Text className="font-numeric text-base text-ink dark:text-paper">
                  {formatRating(avgRating)}
                </Text>{" "}
                (<Text className="font-numeric text-base text-ink dark:text-paper">{data.reviewCount}</Text> reviews)
              </Text>
            </View>
          </View>
        </View>
        {data.dj.genres && data.dj.genres.length > 0 ? (
          <View className="mt-3">
            <GenreTags genres={data.dj.genres} />
          </View>
        ) : null}
        {data.dj.bio ? <Text className="mt-3 text-ink dark:text-paper">{data.dj.bio}</Text> : null}
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data.recentReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={{ ...item, dj: data.dj }} />}
        ListEmptyComponent={<EmptyState message="No reviews yet for this DJ." />}
      />
    </Page>
  );
}
