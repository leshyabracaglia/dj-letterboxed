import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { ArtistSearchInput, type ArtistPick } from "../../components/ArtistSearchInput";
import { MetalButton } from "../../components/MetalButton";
import { RatingStars } from "../../components/RatingStars";
import { ScreenHeader } from "../../components/ScreenHeader";
import { TagFriendsPicker } from "../../components/TagFriendsPicker";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type {
  CreateEventInput,
  CreateReviewInput,
  Dj,
  Event,
  Paginated,
  Review,
  User,
} from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

const VIBES = [
  { value: "electric", label: "⚡ Electric" },
  { value: "good", label: "🙂 Good" },
  { value: "average", label: "😐 Average" },
  { value: "dead", label: "💀 Dead" },
] as const;

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function LogSetScreen() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
  });

  const [djName, setDjName] = useState("");
  const [artistPick, setArtistPick] = useState<ArtistPick | null>(null);
  const [djBio, setDjBio] = useState("");
  const [eventName, setEventName] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [seenAt, setSeenAt] = useState(todayISODate());
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [crowdVibe, setCrowdVibe] = useState<(typeof VIBES)[number]["value"] | undefined>();
  const [reviewText, setReviewText] = useState("");
  const [taggedUsers, setTaggedUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createDj = useMutation({
    mutationFn: (input: {
      name: string;
      bio?: string;
      spotifyId?: string;
      imageUrl?: string;
      genres?: string[];
    }) => api.post<Dj>("/djs", input),
  });
  const createEvent = useMutation({
    mutationFn: (input: CreateEventInput) => api.post<Event>("/events", input),
  });
  const createLog = useMutation({
    mutationFn: (input: CreateReviewInput) => api.post<Review>("/reviews", input),
  });

  const pending = createDj.isPending || createEvent.isPending || createLog.isPending;

  const onSubmit = async () => {
    setError(null);
    if (!djName.trim()) {
      setError("DJ name is required");
      return;
    }
    const seenAtDate = new Date(seenAt);
    if (Number.isNaN(seenAtDate.getTime())) {
      setError("Enter the date you saw them as YYYY-MM-DD");
      return;
    }

    try {
      const dj =
        artistPick?.type === "existing"
          ? artistPick.dj
          : await createDj.mutateAsync(
              artistPick?.type === "spotify"
                ? {
                    name: artistPick.artist.name,
                    bio: djBio.trim() || undefined,
                    spotifyId: artistPick.artist.spotifyId,
                    imageUrl: artistPick.artist.imageUrl ?? undefined,
                    genres: artistPick.artist.genres,
                  }
                : { name: djName.trim(), bio: djBio.trim() || undefined },
            );

      let event: Event | undefined;
      if (eventName.trim() && venue.trim()) {
        event = await createEvent.mutateAsync({
          name: eventName.trim(),
          venue: venue.trim(),
          city: city.trim() || undefined,
          eventDate: seenAtDate.toISOString(),
        });
      }

      const created = await createLog.mutateAsync({
        djId: dj.id,
        eventId: event?.id,
        ratingHalfStars: rating,
        reviewText: reviewText.trim() || undefined,
        crowdVibe,
        seenAt: seenAtDate.toISOString(),
        taggedUserIds: taggedUsers.map((u) => u.id),
      });

      // Seed the profile list with the full review (server response only
      // carries bare row fields) so it's there the instant we redirect,
      // instead of a blank/stale list until a background refetch lands.
      if (me?.username) {
        const reviewsKey = queryKeys.reviews.byUser(me.username);
        const fullReview: Review = {
          ...created,
          dj,
          event,
          taggedUsers,
          likeCount: 0,
          commentCount: 0,
          isLikedByMe: false,
        };
        queryClient.setQueryData<Paginated<Review>>(reviewsKey, (old) => ({
          items: [fullReview, ...(old?.items ?? [])],
          nextCursor: old?.nextCursor ?? null,
        }));
        queryClient.invalidateQueries({ queryKey: reviewsKey });
        queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(me.username) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.djs.bySlug(dj.slug) });
      if (event) queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(event.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.activity() });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.popular() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.leaderboard() });

      router.replace(ROUTES.PROFILE);
    } catch (err: any) {
      setError(err?.message ?? "Could not save your log");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <ScreenHeader title="Log a Set" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="mb-1 text-sm font-medium text-muted">DJ</Text>
          <View className="mb-4">
            <ArtistSearchInput
              value={djName}
              hasSelection={artistPick !== null}
              onChangeText={(text) => {
                setDjName(text);
                setArtistPick(null);
              }}
              onSelect={(pick) => {
                setArtistPick(pick);
                setDjName(pick.type === "existing" ? pick.dj.name : pick.artist.name);
              }}
            />
          </View>

          {djName.trim() && artistPick?.type !== "existing" ? (
            <View className="mb-4">
              <Text className="mb-1 text-sm font-medium text-muted">
                Quick bio for {djName.trim()} (optional)
              </Text>
              <TextInput
                placeholder="A sentence or two about them"
                value={djBio}
                onChangeText={setDjBio}
                multiline
                numberOfLines={2}
                className="min-h-16 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
              />
            </View>
          ) : null}

          <Text className="mb-1 text-sm font-medium text-muted">Event (optional)</Text>
          <TextInput
            placeholder="Event name"
            value={eventName}
            onChangeText={setEventName}
            className="mb-2 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
          />
          <TextInput
            placeholder="Venue"
            value={venue}
            onChangeText={setVenue}
            className="mb-2 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
          />
          <TextInput
            placeholder="City"
            value={city}
            onChangeText={setCity}
            className="mb-4 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
          />

          <Text className="mb-1 text-sm font-medium text-muted">Date you saw them</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            value={seenAt}
            onChangeText={setSeenAt}
            className="mb-4 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
          />

          <Text className="mb-1 text-sm font-medium text-muted">Rating</Text>
          <View className="mb-4">
            <RatingStars value={rating} onChange={setRating} size={28} />
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Crowd vibe</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {VIBES.map((v) => (
              <Pressable
                key={v.value}
                onPress={() => setCrowdVibe(v.value)}
                className={`rounded-full px-3 py-2 ${
                  crowdVibe === v.value ? "bg-primary" : "bg-white dark:bg-surface-dark border border-primary/20"
                }`}
              >
                <Text className={crowdVibe === v.value ? "text-paper" : "text-ink dark:text-paper"}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Review</Text>
          <TextInput
            placeholder="How was it?"
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={4}
            className="mb-4 min-h-24 rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
          />

          <Text className="mb-1 text-sm font-medium text-muted">Tag friends (optional)</Text>
          <View className="mb-4">
            <TagFriendsPicker
              taggedUsers={taggedUsers}
              onAdd={(user) => setTaggedUsers((prev) => [...prev, user])}
              onRemove={(userId) =>
                setTaggedUsers((prev) => prev.filter((u) => u.id !== userId))
              }
            />
          </View>

          {error ? <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text> : null}

          <MetalButton disabled={pending} onPress={onSubmit} className="rounded-xl py-3">
            <Text className="text-center font-semibold text-paper">
              {pending ? "Saving..." : "Save log"}
            </Text>
          </MetalButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
