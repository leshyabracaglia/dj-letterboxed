import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ArtistSearchInput, type ArtistPick } from "../../components/ArtistSearchInput";
import { RatingStars } from "../../components/RatingStars";
import { TagFriendsPicker } from "../../components/TagFriendsPicker";
import { useApi } from "../../lib/api/client";
import type {
  CreateEventInput,
  CreateReviewInput,
  Dj,
  Event,
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

  const [djName, setDjName] = useState("");
  const [artistPick, setArtistPick] = useState<ArtistPick | null>(null);
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
      spotifyId?: string;
      imageUrl?: string;
      genres?: string[];
    }) => api.post<Dj>("/api/djs", input),
  });
  const createEvent = useMutation({
    mutationFn: (input: CreateEventInput) => api.post<Event>("/api/events", input),
  });
  const createLog = useMutation({
    mutationFn: (input: CreateReviewInput) => api.post<Review>("/api/reviews", input),
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
                    spotifyId: artistPick.artist.spotifyId,
                    imageUrl: artistPick.artist.imageUrl ?? undefined,
                    genres: artistPick.artist.genres,
                  }
                : { name: djName.trim() },
            );

      let eventId: string | undefined;
      if (eventName.trim() && venue.trim()) {
        const event = await createEvent.mutateAsync({
          name: eventName.trim(),
          venue: venue.trim(),
          city: city.trim() || undefined,
          eventDate: seenAtDate.toISOString(),
        });
        eventId = event.id;
      }

      await createLog.mutateAsync({
        djId: dj.id,
        eventId,
        ratingHalfStars: rating,
        reviewText: reviewText.trim() || undefined,
        crowdVibe,
        seenAt: seenAtDate.toISOString(),
        taggedUserIds: taggedUsers.map((u) => u.id),
      });

      router.replace(ROUTES.PROFILE);
    } catch (err: any) {
      setError(err?.message ?? "Could not save your log");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text className="mb-4 text-2xl font-bold text-ink">Log a set</Text>

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

          <Text className="mb-1 text-sm font-medium text-muted">Event (optional)</Text>
          <TextInput
            placeholder="Event name"
            value={eventName}
            onChangeText={setEventName}
            className="mb-2 rounded-lg border border-muted/30 bg-white px-4 py-3"
          />
          <TextInput
            placeholder="Venue"
            value={venue}
            onChangeText={setVenue}
            className="mb-2 rounded-lg border border-muted/30 bg-white px-4 py-3"
          />
          <TextInput
            placeholder="City"
            value={city}
            onChangeText={setCity}
            className="mb-4 rounded-lg border border-muted/30 bg-white px-4 py-3"
          />

          <Text className="mb-1 text-sm font-medium text-muted">Date you saw them</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            value={seenAt}
            onChangeText={setSeenAt}
            className="mb-4 rounded-lg border border-muted/30 bg-white px-4 py-3"
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
                  crowdVibe === v.value ? "bg-ink" : "bg-white border border-muted/30"
                }`}
              >
                <Text className={crowdVibe === v.value ? "text-paper" : "text-ink"}>
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
            className="mb-4 min-h-24 rounded-lg border border-muted/30 bg-white px-4 py-3"
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

          {error ? <Text className="mb-3 text-accent">{error}</Text> : null}

          <Pressable
            disabled={pending}
            onPress={onSubmit}
            className="rounded-lg bg-ink py-3"
          >
            <Text className="text-center font-semibold text-paper">
              {pending ? "Saving..." : "Save log"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
