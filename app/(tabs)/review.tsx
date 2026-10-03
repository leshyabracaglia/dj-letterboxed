import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { useDjSearch, useVenueSearch } from "../../lib/api/hooks";
import { useCurrentUser } from "../../lib/auth";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type {
  CreateEventInput,
  Dj,
  Event,
  Paginated,
  PlaceSuggestion,
  Review,
  SpotifyArtist,
  User,
  CrowdVibe,
  VenueSummary,
} from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";
import { isIos } from "@/lib/utils";

type ICreateDjInput = {
  name: string;
  bio?: string;
  genres?: string[];
  spotifyId?: string;
  imageUrl?: string;
};

// TODO: have POST /reviews create the artist and event when they don't exist
// yet (and return the full review), so this screen can make a single call.
type ICreateReviewInput = {
  djId: string;
  eventId?: string;
  rating?: number;
  reviewText?: string;
  crowdVibe?: CrowdVibe;
  crowdVibeNote?: string;
  seenAt: string;
  taggedUserIds?: string[];
};

// An already-saved DJ, or one (from Spotify or typed in by hand) that gets
// created when the review is saved.
type IArtistPick = { type: "existing"; dj: Dj } | { type: "new"; input: ICreateDjInput };

// An already-saved venue, a Google Places result (saved as a venue when the
// review is saved), or a name typed in by hand.
type IVenuePick =
  | { type: "existing"; venue: VenueSummary }
  | { type: "place"; place: PlaceSuggestion }
  | { type: "typed"; name: string };

// Form fields as typed; turned into API inputs on submit.
type IReviewDraft = {
  eventName: string;
  venuePick?: IVenuePick;
  // Only asked for (and sent) for a typed-in venue; saved and Google venues
  // already know their city.
  city: string;
  seenAt: string;
  rating?: number;
  crowdVibe?: CrowdVibe;
  reviewText: string;
  taggedUsers: User[];
};

function emptyDraft(): IReviewDraft {
  return {
    eventName: "",
    city: "",
    seenAt: new Date().toISOString().slice(0, 10),
    reviewText: "",
    taggedUsers: [],
  };
}

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
  onSelect: (pick: IArtistPick) => void;
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
  const rows: IArtistPick[] = (spotifyResults ?? []).map((artist) => {
    const dj = localBySpotifyId.get(artist.spotifyId);
    return dj ? { type: "existing", dj } : { type: "new", input: artist };
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
              ) : (
                <ArtistResultRow
                  key={`spotify-${row.input.spotifyId}`}
                  name={row.input.name}
                  imageUrl={row.input.imageUrl}
                  subtitle={row.input.genres?.join(", ") ?? ""}
                  onPress={() => onSelect(row)}
                />
              ),
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
  isFromCommunity,
  actionLabel,
  onAction,
  onClear,
}: {
  name: string;
  imageUrl?: string | null;
  genres: string[];
  bio?: string | null;
  isFromCommunity?: boolean;
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
          {!!isFromCommunity && <Text className="text-xs text-muted">{COMMUNITY_ADDED_LABEL}</Text>}
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
      {genres.length > 0 && (
        <View className="mt-3">
          <GenreTags genres={genres} limit={5} />
        </View>
      )}
      {!!bio && (
        <Text numberOfLines={4} className="mt-3 text-sm text-ink/80 dark:text-paper/80">
          {bio}
        </Text>
      )}
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
  initial: ICreateDjInput;
  onClose: () => void;
  onSave: (draft: ICreateDjInput) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [bio, setBio] = useState(initial.bio);
  const [error, setError] = useState<string>();

  const trimmedImageUrl = imageUrl?.trim();

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
      imageUrl: trimmedImageUrl || undefined,
      bio: bio?.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={isIos ? "padding" : undefined}
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

              <Text className="mb-1 text-sm font-medium text-muted">Quick bio (optional)</Text>
              <TextInput
                placeholder="A sentence or two about them"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                className={`min-h-20 ${INPUT_CLASS}`}
              />

              {error && <Text className="mt-3 text-danger dark:text-danger-dark">{error}</Text>}
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

// Groups a venue search's Google Places calls (and the save of the picked
// place) into one billing session. Any URL-safe string up to 36 chars works.
function newPlacesSessionToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function venuePickName(pick: IVenuePick) {
  if (pick.type === "existing") return pick.venue.name;
  if (pick.type === "place") return pick.place.name;
  return pick.name;
}

function venuePickKey(pick: IVenuePick) {
  if (pick.type === "existing") return `local-${pick.venue.id}`;
  if (pick.type === "place") return `place-${pick.place.placeId}`;
  return `typed-${pick.name}`;
}

function venuePickSubtitle(pick: IVenuePick) {
  if (pick.type === "existing") return pick.venue.address ?? pick.venue.city ?? "";
  if (pick.type === "place") return pick.place.secondaryText;
  return "Added by you";
}

function VenueResultRow({
  name,
  subtitle,
  onPress,
}: {
  name: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: RESULT_ROW_HEIGHT }}
      className="justify-center border-b border-muted/10 px-4 active:bg-primary-tint/40 dark:active:bg-primary/10"
    >
      <Text numberOfLines={1} className="text-ink dark:text-paper">
        {name}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} className="text-xs text-muted">
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

function VenueSearchInput({
  sessionToken,
  onSelect,
}: {
  sessionToken: string;
  onSelect: (pick: IVenuePick) => void;
}) {
  const api = useApi();
  const [value, setValue] = useState("");
  const query = value.trim();
  const enabled = query.length > 1;
  // Google bills per request, so wait for a pause in typing; the local
  // search is cheap and stays instant.
  const placesQuery = useDebouncedValue(query, 300);

  const { data: localResults, isFetching: isLocalFetching } = useVenueSearch(query, enabled);
  const { data: placeResults, isFetching: isPlacesFetching } = useQuery({
    queryKey: queryKeys.venues.placesSearch(placesQuery),
    queryFn: () =>
      api.get<PlaceSuggestion[]>("/venues/places-search", { q: placesQuery, sessionToken }),
    enabled: enabled && placesQuery.length > 1,
    // Place search is optional (503 when the server has no API key); fall
    // back to saved and typed venues instead of retrying.
    retry: false,
  });

  // Venues already on Beatboxd lead (they carry review history); Google
  // results follow, minus any place someone already saved.
  const locals = localResults ?? [];
  const savedPlaceIds = new Set(locals.flatMap((v) => (v.googlePlaceId ? [v.googlePlaceId] : [])));
  const rows: IVenuePick[] = [
    ...locals.map((venue) => ({ type: "existing" as const, venue })),
    ...(placeResults ?? [])
      .filter((place) => !savedPlaceIds.has(place.placeId))
      .map((place) => ({ type: "place" as const, place })),
  ];
  const isFetching = isLocalFetching || isPlacesFetching || placesQuery !== query;

  return (
    <View>
      <TextInput
        placeholder="Venue"
        value={value}
        onChangeText={setValue}
        className={INPUT_CLASS}
      />
      {enabled ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-primary/20 bg-white dark:bg-surface-dark">
          <ScrollView
            style={{ maxHeight: RESULT_ROW_HEIGHT * VISIBLE_RESULT_ROWS }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {rows.map((row) => (
              <VenueResultRow
                key={venuePickKey(row)}
                name={venuePickName(row)}
                subtitle={venuePickSubtitle(row)}
                onPress={() => onSelect(row)}
              />
            ))}
            {isFetching ? (
              <View
                style={{ height: RESULT_ROW_HEIGHT }}
                className="justify-center border-b border-muted/10 px-4"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-56" />
              </View>
            ) : null}
          </ScrollView>
          <Pressable
            onPress={() => onSelect({ type: "typed", name: query })}
            className="flex-row items-center gap-3 px-4 py-3 active:bg-primary-tint/40 dark:active:bg-primary/10"
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg border border-dashed border-accent/60">
              <Text className="text-lg text-accent-text dark:text-accent-dark">+</Text>
            </View>
            <Text numberOfLines={1} className="flex-1 font-medium text-accent-text dark:text-accent-dark">
              Use &ldquo;{query}&rdquo;
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SelectedVenueCard({ pick, onClear }: { pick: IVenuePick; onClear: () => void }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-primary/20 bg-white px-4 py-3 dark:bg-surface-dark">
      <View className="flex-1">
        <Text numberOfLines={1} className="font-semibold text-ink dark:text-paper">
          {venuePickName(pick)}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted">
          {venuePickSubtitle(pick)}
        </Text>
      </View>
      <Pressable onPress={onClear} hitSlop={8}>
        <Text className="text-sm text-muted">Change</Text>
      </Pressable>
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
      {taggedUsers.length > 0 && (
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
      )}
      <TextInput
        placeholder="Tag friends who were there"
        value={query}
        onChangeText={setQuery}
        className={INPUT_CLASS}
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

export default function CreateReviewScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();

  const { me } = useCurrentUser();

  const [djQuery, setDjQuery] = useState("");
  const [artistPick, setArtistPick] = useState<IArtistPick>();
  const [showCreateArtist, setShowCreateArtist] = useState(false);
  const [draft, setDraft] = useState<IReviewDraft>(emptyDraft);
  const [placesSessionToken, setPlacesSessionToken] = useState(newPlacesSessionToken);
  const [error, setError] = useState<string>();

  const updateDraft = (changes: Partial<IReviewDraft>) =>
    setDraft((prev) => ({ ...prev, ...changes }));

  const createDj = useMutation({
    mutationFn: (input: ICreateDjInput) => api.post<Dj>("/djs", input),
  });
  const createEvent = useMutation({
    mutationFn: (input: CreateEventInput) => api.post<Event>("/events", input),
  });
  const createReview = useMutation({
    mutationFn: (input: ICreateReviewInput) => api.post<Review>("/reviews", input),
  });

  const resetForm = () => {
    setDjQuery("");
    setArtistPick(undefined);
    setDraft(emptyDraft());
    setPlacesSessionToken(newPlacesSessionToken());
    setError(undefined);
  };

  const pending = createDj.isPending || createEvent.isPending || createReview.isPending;

  const onSubmit = async () => {
    setError(undefined);
    if (!me) {
      setError("Must be logged in to create a review");
      return;
    }
    if (!artistPick) {
      setError("Pick a DJ from the list, or create a new artist");
      return;
    }
    const seenAtDate = new Date(draft.seenAt);
    if (Number.isNaN(seenAtDate.getTime())) {
      setError("Enter the date you saw them as YYYY-MM-DD");
      return;
    }
    const { venuePick } = draft;
    if (draft.eventName.trim() && !venuePick) {
      setError("Pick the venue for this event");
      return;
    }

    try {
      const dj =
        artistPick.type === "existing" ? artistPick.dj : await createDj.mutateAsync(artistPick.input);

      let event: Event | undefined;
      if (venuePick) {
        event = await createEvent.mutateAsync({
          // A venue with no event name logs as a night at that venue.
          name: draft.eventName.trim() || venuePickName(venuePick),
          ...(venuePick.type === "existing"
            ? { venueId: venuePick.venue.id }
            : venuePick.type === "place"
              ? { placeId: venuePick.place.placeId, placeSessionToken: placesSessionToken }
              : { venue: venuePick.name, city: draft.city.trim() || undefined }),
          eventDate: seenAtDate.toISOString(),
        });
      }

      const createdReview = await createReview.mutateAsync({
        djId: dj.id,
        eventId: event?.id,
        rating: draft.rating,
        reviewText: draft.reviewText.trim() || undefined,
        crowdVibe: draft.crowdVibe,
        seenAt: seenAtDate.toISOString(),
        taggedUserIds: draft.taggedUsers.map((u) => u.id),
      });

      // The server response only carries bare row fields; seed the profile
      // list and the detail page with the full review so both render
      // instantly instead of waiting on a background refetch.
      const fullReview: Review = {
        ...createdReview,
        dj,
        event,
        user: me,
        taggedUsers: draft.taggedUsers,
        likeCount: 0,
        commentCount: 0,
        isLikedByMe: false,
      };
      const reviewsKey = queryKeys.reviews.byUser(me.username);
      queryClient.setQueryData<Paginated<Review>>(reviewsKey, (old) => ({
        items: [fullReview, ...(old?.items ?? [])],
        nextCursor: old?.nextCursor ?? null,
      }));
      queryClient.setQueryData<Review>(queryKeys.reviews.byId(createdReview.id), fullReview);

      queryClient.invalidateQueries({ queryKey: reviewsKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(me.username) });
      queryClient.invalidateQueries({ queryKey: queryKeys.djs.bySlug(dj.slug) });
      if (event) queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(event.id) });
      if (event?.venueId) queryClient.invalidateQueries({ queryKey: queryKeys.venues.byId(event.venueId) });
      queryClient.invalidateQueries({ queryKey: ["venues", "search"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.activity() });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.popular() });

      // The tab stays mounted behind the review page, so clear it for the
      // next log rather than leaving this one's answers filled in on back.
      resetForm();
      router.push(ROUTES.REVIEW_DETAIL(createdReview.id, { justLogged: true }));
    } catch (err: any) {
      setError(err?.message ?? "Could not save your review");
    }
  };

  const selectedArtist = artistPick?.type === "existing" ? artistPick.dj : artistPick?.input;

  return (
    <Page title="Review a Set">
      <KeyboardAvoidingView behavior={isIos ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <Text className="mb-1 text-sm font-medium text-muted">DJ</Text>
          <View className="mb-4">
            {selectedArtist ? (
              <SelectedArtistCard
                name={selectedArtist.name}
                imageUrl={selectedArtist.imageUrl}
                genres={selectedArtist.genres ?? []}
                bio={selectedArtist.bio}
                isFromCommunity={!selectedArtist.spotifyId}
                actionLabel="Edit"
                // Only hand-made artists (not yet saved, not from Spotify) are editable.
                onAction={
                  artistPick?.type === "new" && !artistPick.input.spotifyId
                    ? () => setShowCreateArtist(true)
                    : undefined
                }
                onClear={() => setArtistPick(undefined)}
              />
            ) : (
              <ArtistSearchInput
                value={djQuery}
                onChangeText={setDjQuery}
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
              initial={artistPick?.type === "new" ? artistPick.input : { name: djQuery.trim() }}
              onClose={() => setShowCreateArtist(false)}
              onSave={(input) => {
                setArtistPick({ type: "new", input });
                setShowCreateArtist(false);
              }}
            />
          ) : null}

          <Text className="mb-1 text-sm font-medium text-muted">Event (optional)</Text>
          <TextInput
            placeholder="Event name"
            value={draft.eventName}
            onChangeText={(eventName) => updateDraft({ eventName })}
            className={`mb-2 ${INPUT_CLASS}`}
          />
          <View className="mb-4">
            {draft.venuePick ? (
              <SelectedVenueCard
                pick={draft.venuePick}
                onClear={() => {
                  updateDraft({ venuePick: undefined });
                  // A new search is a new Google billing session.
                  setPlacesSessionToken(newPlacesSessionToken());
                }}
              />
            ) : (
              <VenueSearchInput
                sessionToken={placesSessionToken}
                onSelect={(venuePick) => updateDraft({ venuePick })}
              />
            )}
            {draft.venuePick?.type === "typed" ? (
              <TextInput
                placeholder="City"
                value={draft.city}
                onChangeText={(city) => updateDraft({ city })}
                className={`mt-2 ${INPUT_CLASS}`}
              />
            ) : null}
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Date you saw them</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            value={draft.seenAt}
            onChangeText={(seenAt) => updateDraft({ seenAt })}
            className={`mb-4 ${INPUT_CLASS}`}
          />

          <Text className="mb-1 text-sm font-medium text-muted">Rating</Text>
          <View className="mb-4">
            <RatingStars value={draft.rating} onChange={(rating) => updateDraft({ rating })} size={22} />
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Crowd vibe</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {VIBES.map((v) => (
              <Pressable
                key={v.value}
                onPress={() => updateDraft({ crowdVibe: v.value })}
                className={`rounded-full px-3 py-2 ${
                  draft.crowdVibe === v.value ? "bg-primary" : "bg-white dark:bg-surface-dark border border-primary/20"
                }`}
              >
                <Text className={draft.crowdVibe === v.value ? "text-paper" : "text-ink dark:text-paper"}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Review</Text>
          <TextInput
            placeholder="How was it?"
            value={draft.reviewText}
            onChangeText={(reviewText) => updateDraft({ reviewText })}
            multiline
            numberOfLines={4}
            className={`mb-4 min-h-24 ${INPUT_CLASS}`}
          />

          <Text className="mb-1 text-sm font-medium text-muted">Tag friends (optional)</Text>
          <View className="mb-4">
            <TagFriendsPicker
              taggedUsers={draft.taggedUsers}
              onAdd={(user) =>
                setDraft((prev) => ({ ...prev, taggedUsers: [...prev.taggedUsers, user] }))
              }
              onRemove={(userId) =>
                setDraft((prev) => ({
                  ...prev,
                  taggedUsers: prev.taggedUsers.filter((u) => u.id !== userId),
                }))
              }
            />
          </View>

          {!!error && <Text className="mb-3 text-danger dark:text-danger-dark">{error}</Text>}

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
