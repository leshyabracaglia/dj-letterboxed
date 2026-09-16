import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { Avatar } from "../../components/Avatar";
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24, alignItems: "center" }}>
        <View className="w-full max-w-xl rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark p-5 shadow-sm">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Link href={ROUTES.DJ(log.dj.slug)}>
                <Text className="text-2xl font-bold text-primary dark:text-primary-dark">
                  {log.dj.name}
                </Text>
              </Link>
            </View>
            <RatingStars value={log.ratingHalfStars} size={20} />
          </View>

          {log.event ? (
            <Link href={ROUTES.EVENT(log.event.id)}>
              <Text className="mt-2 text-sm font-medium text-accent-text dark:text-accent-dark">
                {log.event.name} · {log.event.venue}
              </Text>
            </Link>
          ) : null}

          <Text className="mt-1 text-sm text-muted">Seen {formatDate(log.seenAt)}</Text>

          {log.crowdVibe ? (
            <View className="mt-3">
              <CrowdVibeBadge vibe={log.crowdVibe} />
            </View>
          ) : null}

          {log.reviewText ? (
            <Text className="mt-4 text-base text-ink dark:text-paper">{log.reviewText}</Text>
          ) : null}

          {log.taggedUsers && log.taggedUsers.length > 0 ? (
            <Text className="mt-3 text-sm text-muted">
              With {log.taggedUsers.map((u) => `@${u.username}`).join(", ")}
            </Text>
          ) : null}

          <View className="mt-4 flex-row items-center justify-between border-t border-primary/10 pt-4">
            <Link href={ROUTES.USER(log.user.username)} asChild>
              <Pressable className="flex-row items-center gap-2 active:opacity-80">
                <Avatar
                  uri={log.user.avatarUrl}
                  name={log.user.displayName ?? log.user.username}
                  size={28}
                />
                <Text className="text-sm text-muted">Logged by @{log.user.username}</Text>
              </Pressable>
            </Link>
            <LikeButton reviewId={log.id} likeCount={log.likeCount} isLiked={log.isLikedByMe} />
          </View>
        </View>

        <View className="w-full max-w-xl">
          <CommentSection reviewId={log.id} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
