import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import {
  Avatar,
  Button,
  Page,
  RatingStars,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type {
  CreateEventInput,
  CreateReviewInput,
  Dj,
  Event,
  Paginated,
  Review,
  SpotifyArtist,
  User,
} from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

type ArtistPick =
  | { type: "existing"; dj: Dj }
  | { type: "spotify"; artist: SpotifyArtist };

function ArtistSearchInput({
  value,
  onChangeText,
  onSelect,
  hasSelection,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (pick: ArtistPick) => void;
  hasSelection: boolean;
}) {
  const api = useApi();
  const query = value.trim();
  const enabled = query.length > 1 && !hasSelection;

  const { data: localResults, isFetching: isLocalFetching } = useQuery({
    queryKey: queryKeys.djs.search(query),
    queryFn: () => api.get<Dj[]>("/djs/search", { q: query }),
    enabled,
  });
  const { data: spotifyResults, isFetching: isSpotifyFetching } = useQuery({
    queryKey: queryKeys.djs.spotifySearch(query),
    queryFn: () => api.get<SpotifyArtist[]>("/djs/spotify-search", { q: query }),
    enabled,
  });

  const showDropdown =
    enabled &&
    ((localResults?.length ?? 0) > 0 ||
      (spotifyResults?.length ?? 0) > 0 ||
      isLocalFetching ||
      isSpotifyFetching);

  return (
    <View>
      <TextInput
        placeholder="Who did you see?"
        value={value}
        onChangeText={onChangeText}
        className="rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
      />
      {showDropdown ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary">
          {isLocalFetching || isSpotifyFetching ? (
            <View className="px-4 py-2">
              <ActivityIndicator size="small" />
            </View>
          ) : null}
          {(localResults ?? []).map((dj) => (
            <Pressable
              key={`local-${dj.id}`}
              onPress={() => onSelect({ type: "existing", dj })}
              className="border-b border-muted/10 px-4 py-3"
            >
              <Text className="text-ink dark:text-paper">{dj.name}</Text>
              <Text className="text-xs text-muted">Already on Beatboxd</Text>
            </Pressable>
          ))}
          {(spotifyResults ?? []).map((artist) => (
            <Pressable
              key={`spotify-${artist.spotifyId}`}
              onPress={() => onSelect({ type: "spotify", artist })}
              className="border-b border-muted/10 px-4 py-3"
            >
              <Text className="text-ink dark:text-paper">{artist.name}</Text>
              <Text className="text-xs text-muted">
                {artist.genres.length > 0 ? artist.genres.join(", ") : "From Spotify"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {query.length > 1 && !hasSelection ? (
        <Text className="mt-1 text-xs text-muted">
          Can&apos;t find them? Just keep typing their name and we&apos;ll add them for you.
        </Text>
      ) : null}
    </View>
  );
}

function TagFriendsPicker({
  taggedUsers,
  onAdd,
  onRemove,
}: {
  taggedUsers: User[];
  onAdd: (user: User) => void;
  onRemove: (userId: string) => void;
}) {
  const api = useApi();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const { data: results } = useQuery({
    queryKey: queryKeys.users.search(trimmed),
    queryFn: () => api.get<User[]>("/users/search", { q: trimmed }),
    enabled: trimmed.length > 1,
  });

  const taggedIds = new Set(taggedUsers.map((u) => u.id));

  return (
    <View>
      {taggedUsers.length > 0 ? (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {taggedUsers.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => onRemove(u.id)}
              className="flex-row items-center gap-1.5 rounded-full border border-accent/40 bg-accent-tint px-3 py-1.5 active:opacity-80 dark:bg-accent/20"
            >
              <Avatar uri={u.avatarUrl} name={u.displayName ?? u.username} size={16} />
              <Text className="text-accent-text dark:text-accent-dark">@{u.username} ✕</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        placeholder="Tag friends who were there"
        value={query}
        onChangeText={setQuery}
        className="rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
      />
      {trimmed.length > 1 && results && results.length > 0 ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary">
          {results
            .filter((u) => !taggedIds.has(u.id))
            .map((u) => (
              <Pressable
                key={u.id}
                onPress={() => {
                  onAdd(u);
                  setQuery("");
                }}
                className="flex-row items-center gap-2 border-b border-muted/10 px-4 py-3"
              >
                <Avatar uri={u.avatarUrl} name={u.displayName ?? u.username} size={28} />
                <View>
                  <Text className="text-ink dark:text-paper">{u.displayName ?? u.username}</Text>
                  <Text className="text-xs text-muted">@{u.username}</Text>
                </View>
              </Pressable>
            ))}
        </View>
      ) : null}
    </View>
  );
}

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
  const contentStyle = usePageContentStyle();

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
  const createReview = useMutation({
    mutationFn: (input: CreateReviewInput) => api.post<Review>("/reviews", input),
  });

  const pending = createDj.isPending || createEvent.isPending || createReview.isPending;

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

      const created = await createReview.mutateAsync({
        djId: dj.id,
        eventId: event?.id,
        rating,
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

      router.replace(ROUTES.PROFILE);
    } catch (err: any) {
      setError(err?.message ?? "Could not save your log");
    }
  };

  return (
    <Page title="Log a Set">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={contentStyle}>
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
            <RatingStars value={rating} onChange={setRating} size={22} />
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

          <Button disabled={pending} onPress={onSubmit} className="py-3">
            <Text className="text-center font-semibold text-paper">
              {pending ? "Saving..." : "Save log"}
            </Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}
