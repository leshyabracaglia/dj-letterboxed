import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import {
  Avatar,
  Button,
  GenreTags,
  Page,
  RatingStars,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useDjSearch } from "../../lib/api/hooks";
import { useCurrentUser } from "../../lib/auth";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type {
  CreateDjInput,
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

type NewArtistDraft = {
  name: string;
  bio: string;
  imageUrl: string;
  genres: string[];
};

type ArtistPick =
  | { type: "existing"; dj: Dj }
  | { type: "spotify"; artist: SpotifyArtist }
  | { type: "new"; draft: NewArtistDraft };

const INPUT_CLASS =
  "rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted";

// Fixed row height so the dropdown can cap itself at exactly five rows.
const RESULT_ROW_HEIGHT = 64;
const VISIBLE_RESULT_ROWS = 5;

function ArtistResultRow({
  name,
  imageUrl,
  subtitle,
  onPress,
}: {
  name: string;
  imageUrl?: string | null;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: RESULT_ROW_HEIGHT }}
      className="flex-row items-center gap-3 border-b border-muted/10 px-4 active:bg-primary-tint/40 dark:active:bg-primary/10"
    >
      <Avatar uri={imageUrl} name={name} size={40} />
      <View className="flex-1">
        <Text numberOfLines={1} className="text-ink dark:text-paper">
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="text-xs text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const COMMUNITY_ADDED_LABEL = "Added by the community";

// Spotify-backed artists are the norm; only call out community-added ones.
function djSubtitle(dj: Dj) {
  const genres = dj.genres?.join(", ") ?? "";
  if (dj.spotifyId) return genres;
  return genres ? `${COMMUNITY_ADDED_LABEL} · ${genres}` : COMMUNITY_ADDED_LABEL;
}

function ArtistSearchInput({
  value,
  onChangeText,
  onSelect,
  onCreate,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (pick: ArtistPick) => void;
  onCreate: () => void;
}) {
  const api = useApi();
  const query = value.trim();
  const enabled = query.length > 1;

  const { data: localResults, isFetching: isLocalFetching } = useDjSearch(query, enabled);
  const { data: spotifyResults, isFetching: isSpotifyFetching } = useQuery({
    queryKey: queryKeys.djs.spotifySearch(query),
    queryFn: () => api.get<SpotifyArtist[]>("/djs/spotify-search", { q: query }),
    enabled,
  });

  // Spotify results lead, in Spotify's relevance order. One someone already
  // added resolves to its existing Beatboxd DJ (so it isn't listed twice or
  // re-created); community-added DJs with no Spotify match go last.
  const locals = localResults ?? [];
  const localBySpotifyId = new Map(locals.filter((dj) => dj.spotifyId).map((dj) => [dj.spotifyId, dj]));
  const rows: ArtistPick[] = (spotifyResults ?? []).map((artist) => {
    const dj = localBySpotifyId.get(artist.spotifyId);
    return dj ? { type: "existing", dj } : { type: "spotify", artist };
  });
  const listedDjIds = new Set(rows.flatMap((row) => (row.type === "existing" ? [row.dj.id] : [])));
  const remaining = locals.filter((dj) => !listedDjIds.has(dj.id));
  rows.push(
    ...remaining.filter((dj) => dj.spotifyId).map((dj) => ({ type: "existing" as const, dj })),
    ...remaining.filter((dj) => !dj.spotifyId).map((dj) => ({ type: "existing" as const, dj })),
  );
  const isFetching = isLocalFetching || isSpotifyFetching;

  return (
    <View>
      <TextInput
        placeholder="Who did you see?"
        value={value}
        onChangeText={onChangeText}
        className={INPUT_CLASS}
      />
      {enabled ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-primary/20 bg-white dark:bg-surface-dark">
          <ScrollView
            style={{ maxHeight: RESULT_ROW_HEIGHT * VISIBLE_RESULT_ROWS }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {isFetching ? (
              <View
                style={{ height: RESULT_ROW_HEIGHT }}
                className="flex-row items-center gap-3 border-b border-muted/10 px-4"
              >
                <Skeleton className="h-10 w-10 rounded-lg" />
                <View>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </View>
              </View>
            ) : null}
            {rows.map((row) =>
              row.type === "existing" ? (
                <ArtistResultRow
                  key={`local-${row.dj.id}`}
                  name={row.dj.name}
                  imageUrl={row.dj.imageUrl}
                  subtitle={djSubtitle(row.dj)}
                  onPress={() => onSelect(row)}
                />
              ) : row.type === "spotify" ? (
                <ArtistResultRow
                  key={`spotify-${row.artist.spotifyId}`}
                  name={row.artist.name}
                  imageUrl={row.artist.imageUrl}
                  subtitle={row.artist.genres.join(", ")}
                  onPress={() => onSelect(row)}
                />
              ) : null,
            )}
          </ScrollView>
          <Pressable
            onPress={onCreate}
            className="flex-row items-center gap-3 px-4 py-3 active:bg-primary-tint/40 dark:active:bg-primary/10"
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg border border-dashed border-accent/60">
              <Text className="text-lg text-accent-text dark:text-accent-dark">+</Text>
            </View>
            <Text numberOfLines={1} className="flex-1 font-medium text-accent-text dark:text-accent-dark">
              Create artist &ldquo;{query}&rdquo;
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SelectedArtistCard({
  name,
  imageUrl,
  genres,
  bio,
  label,
  actionLabel,
  onAction,
  onClear,
}: {
  name: string;
  imageUrl?: string | null;
  genres: string[];
  bio?: string | null;
  label?: string;
  actionLabel?: string;
  onAction?: () => void;
  onClear: () => void;
}) {
  return (
    <View className="rounded-xl border border-primary/20 bg-white p-4 dark:bg-surface-dark">
      <View className="flex-row items-center gap-3">
        <Avatar uri={imageUrl || null} name={name} size={56} />
        <View className="flex-1">
          <Text className="text-lg font-semibold text-ink dark:text-paper">{name}</Text>
          {label ? <Text className="text-xs text-muted">{label}</Text> : null}
        </View>
        <View className="items-end gap-1">
          {onAction ? (
            <Pressable onPress={onAction} hitSlop={8}>
              <Text className="text-sm font-medium text-accent-text dark:text-accent-dark">
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClear} hitSlop={8}>
            <Text className="text-sm text-muted">Change</Text>
          </Pressable>
        </View>
      </View>
      {genres.length > 0 ? (
        <View className="mt-3">
          <GenreTags genres={genres} limit={5} />
        </View>
      ) : null}
      {bio ? (
        <Text numberOfLines={4} className="mt-3 text-sm text-ink/80 dark:text-paper/80">
          {bio}
        </Text>
      ) : null}
    </View>
  );
}

function CreateArtistModal({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: NewArtistDraft;
  onClose: () => void;
  onSave: (draft: NewArtistDraft) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [genresText, setGenresText] = useState(initial.genres.join(", "));
  const [bio, setBio] = useState(initial.bio);
  const [error, setError] = useState<string | null>(null);

  const trimmedImageUrl = imageUrl.trim();

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Artist name is required");
      return;
    }
    if (trimmedImageUrl && !/^https?:\/\//i.test(trimmedImageUrl)) {
      setError("Image link should start with http:// or https://");
      return;
    }
    onSave({
      name: trimmedName,
      imageUrl: trimmedImageUrl,
      bio: bio.trim(),
      genres: genresText
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Pressable onPress={onClose} className="flex-1 justify-end bg-ink/40">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="max-h-[85%] rounded-t-2xl bg-paper p-5 dark:bg-surface-dark"
          >
            <Text className="mb-1 text-center text-lg font-display text-ink dark:text-paper">
              Add a new artist
            </Text>
            <Text className="mb-4 text-center text-xs text-muted">
              They&apos;ll be added to Beatboxd when you save your review.
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View className="mb-4 items-center">
                <Avatar uri={trimmedImageUrl || null} name={name || "?"} size={88} />
              </View>

              <Text className="mb-1 text-sm font-medium text-muted">Name</Text>
              <TextInput
                placeholder="Artist name"
                value={name}
                onChangeText={setName}
                className={`mb-3 ${INPUT_CLASS}`}
              />

              <Text className="mb-1 text-sm font-medium text-muted">Image link (optional)</Text>
              <TextInput
                placeholder="https://…"
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className={`mb-3 ${INPUT_CLASS}`}
              />

              <Text className="mb-1 text-sm font-medium text-muted">Genres (optional)</Text>
              <TextInput
                placeholder="techno, house, dubstep"
                value={genresText}
                onChangeText={setGenresText}
                autoCapitalize="none"
                className={`mb-3 ${INPUT_CLASS}`}
              />

              <Text className="mb-1 text-sm font-medium text-muted">Quick bio (optional)</Text>
              <TextInput
                placeholder="A sentence or two about them"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                className={`min-h-20 ${INPUT_CLASS}`}
              />

              {error ? (
                <Text className="mt-3 text-danger dark:text-danger-dark">{error}</Text>
              ) : null}
            </ScrollView>
            <View className="mt-4 flex-row gap-3">
              <Button onPress={save} className="flex-1 py-3">
                <Text className="text-center font-semibold text-paper">Add artist</Text>
              </Button>
              <Pressable
                onPress={onClose}
                className="flex-1 items-center justify-center rounded-xl border border-primary/30 py-3"
              >
                <Text className="text-center font-semibold text-ink dark:text-paper">Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
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

export default function ReviewSetScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();

  const { me } = useCurrentUser();

  const [djName, setDjName] = useState("");
  const [artistPick, setArtistPick] = useState<ArtistPick | null>(null);
  const [showCreateArtist, setShowCreateArtist] = useState(false);
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
    mutationFn: (input: CreateDjInput) => api.post<Dj>("/djs", input),
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
    if (!artistPick) {
      setError("Pick a DJ from the list, or create a new artist");
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
                : {
                    name: artistPick.draft.name,
                    bio: artistPick.draft.bio || undefined,
                    imageUrl: artistPick.draft.imageUrl || undefined,
                    genres: artistPick.draft.genres,
                  },
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
      setError(err?.message ?? "Could not save your review");
    }
  };

  return (
    <Page title="Review a Set">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <Text className="mb-1 text-sm font-medium text-muted">DJ</Text>
          <View className="mb-4">
            {artistPick?.type === "existing" ? (
              <SelectedArtistCard
                name={artistPick.dj.name}
                imageUrl={artistPick.dj.imageUrl}
                genres={artistPick.dj.genres ?? []}
                bio={artistPick.dj.bio}
                label={artistPick.dj.spotifyId ? undefined : COMMUNITY_ADDED_LABEL}
                onClear={() => setArtistPick(null)}
              />
            ) : artistPick?.type === "spotify" ? (
              <SelectedArtistCard
                name={artistPick.artist.name}
                imageUrl={artistPick.artist.imageUrl}
                genres={artistPick.artist.genres}
                onClear={() => setArtistPick(null)}
              />
            ) : artistPick?.type === "new" ? (
              <SelectedArtistCard
                name={artistPick.draft.name}
                imageUrl={artistPick.draft.imageUrl}
                genres={artistPick.draft.genres}
                bio={artistPick.draft.bio}
                label="New artist · added to Beatboxd when you save your review"
                actionLabel="Edit"
                onAction={() => setShowCreateArtist(true)}
                onClear={() => setArtistPick(null)}
              />
            ) : (
              <ArtistSearchInput
                value={djName}
                onChangeText={setDjName}
                onSelect={setArtistPick}
                onCreate={() => setShowCreateArtist(true)}
              />
            )}
          </View>
          {showCreateArtist ? (
            // Mounted only while open so the form re-seeds from the current
            // search text / draft each time it opens.
            <CreateArtistModal
              visible
              initial={
                artistPick?.type === "new"
                  ? artistPick.draft
                  : { name: djName.trim(), bio: "", imageUrl: "", genres: [] }
              }
              onClose={() => setShowCreateArtist(false)}
              onSave={(draft) => {
                setArtistPick({ type: "new", draft });
                setShowCreateArtist(false);
              }}
            />
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
              {pending ? "Saving..." : "Save review"}
            </Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}
