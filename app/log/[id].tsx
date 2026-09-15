import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { CommentSection } from "../../components/CommentSection";
import { CrowdVibeBadge } from "../../components/CrowdVibeBadge";
import { LikeButton } from "../../components/LikeButton";
import { RatingStars } from "../../components/RatingStars";
import { ScreenLoading } from "../../components/ScreenLoading";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj, Event, Review, User } from "../../lib/api/types";
import { formatDate } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

// getById always hydrates these relations, so narrow them to required here.
type LogDetail = Review & {
  dj: Dj;
  event: Event | null;
  taggedUsers: User[];
  user: User;
  likeCount: number;
  isLikedByMe: boolean;
};

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { data: log } = useQuery({
    queryKey: queryKeys.reviews.byId(id!),
    queryFn: () => api.get<LogDetail>(`/reviews/${id}`),
  });

  if (!log) {
    return <ScreenLoading />;
  }

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: log.dj.name }} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Link href={ROUTES.DJ(log.dj.slug)}>
          <Text className="text-2xl font-bold text-ink dark:text-paper">{log.dj.name}</Text>
        </Link>
        <View className="mt-2">
          <RatingStars value={log.ratingHalfStars} size={24} />
        </View>

        {log.event ? (
          <Link href={ROUTES.EVENT(log.event.id)}>
            <Text className="mt-3 text-ink dark:text-paper underline">
              {log.event.name} · {log.event.venue}
            </Text>
          </Link>
        ) : null}

        <Text className="mt-1 text-sm text-muted">Seen {formatDate(log.seenAt)}</Text>

        <View className="mt-3">
          <CrowdVibeBadge vibe={log.crowdVibe} />
        </View>

        {log.reviewText ? (
          <Text className="mt-4 text-base text-ink dark:text-paper">{log.reviewText}</Text>
        ) : null}

        {log.taggedUsers && log.taggedUsers.length > 0 ? (
          <Text className="mt-3 text-sm text-muted">
            With{" "}
            {log.taggedUsers.map((u) => `@${u.username}`).join(", ")}
          </Text>
        ) : null}

        <View className="mt-4">
          <LikeButton
            reviewId={log.id}
            likeCount={log.likeCount}
            isLiked={log.isLikedByMe}
          />
        </View>

        <Link href={ROUTES.USER(log.user.username)}>
          <Text className="mt-6 text-muted">
            Logged by @{log.user.username}
          </Text>
        </Link>

        <CommentSection reviewId={log.id} />
      </ScrollView>
    </SafeAreaView>
  );
}
