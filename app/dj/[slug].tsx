import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { GenreTags } from "../../components/GenreTags";
import { RatingStars } from "../../components/RatingStars";
import { ReviewCard } from "../../components/ReviewCard";
import { ScreenLoading } from "../../components/ScreenLoading";
import { useDjDetail } from "../../lib/api/hooks";
import { formatStars } from "../../lib/format";

export default function DjProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data } = useDjDetail(slug);

  if (!data) {
    return <ScreenLoading />;
  }

  // avgRating is the average of `ratingHalfStars` (1-10 units); divide by 2 for a 0.5-5.0 star display.
  const avgHalfStars = data.avgRating ? Number(data.avgRating) : null;

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: data.dj.name }} />
      <View className="border-b border-primary/15 px-4 pb-4 pt-6">
        <View className="flex-row items-center gap-3">
          <Avatar uri={data.dj.imageUrl} name={data.dj.name} size={64} />
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink dark:text-paper">{data.dj.name}</Text>
            <View className="mt-1 flex-row items-center gap-2">
              <RatingStars value={avgHalfStars} />
              <Text className="text-muted">
                <Text className="font-numeric text-base text-ink dark:text-paper">
                  {formatStars(avgHalfStars)}
                </Text>{" "}
                (<Text className="font-numeric text-base text-ink dark:text-paper">{data.logCount}</Text> logs)
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
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data.recentLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard log={{ ...item, dj: data.dj }} />}
        ListEmptyComponent={<EmptyState message="No logs yet for this DJ." />}
      />
    </SafeAreaView>
  );
}
