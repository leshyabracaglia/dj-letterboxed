import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

import { CrowdVibeBadge } from "../../components/CrowdVibeBadge";
import { RatingStars } from "../../components/RatingStars";
import { useTRPC } from "../../hooks/trpc";

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: log } = useQuery(trpc.logs.getById.queryOptions({ id: id! }));

  if (!log) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="text-muted">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title: log.dj.name }} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Link href={`/dj/${log.dj.slug}`}>
          <Text className="text-2xl font-bold text-ink">{log.dj.name}</Text>
        </Link>
        <View className="mt-2">
          <RatingStars value={log.ratingHalfStars} size={24} />
        </View>

        {log.event ? (
          <Link href={`/event/${log.event.id}`}>
            <Text className="mt-3 text-ink underline">
              {log.event.name} · {log.event.venue}
            </Text>
          </Link>
        ) : null}

        <Text className="mt-1 text-sm text-muted">
          Seen {new Date(log.seenAt).toLocaleString()}
        </Text>

        <View className="mt-3">
          <CrowdVibeBadge vibe={log.crowdVibe} />
        </View>

        {log.reviewText ? (
          <Text className="mt-4 text-base text-ink">{log.reviewText}</Text>
        ) : null}

        <Link href={`/user/${log.user.username}`}>
          <Text className="mt-6 text-muted">
            Logged by @{log.user.username}
          </Text>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
