import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  DateInput,
  Icon,
  Page,
  RatingStars,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useDjSearch, useSeriesSearch, useUserSearch, useVenueSearch } from "../../lib/api/hooks";
import { useCurrentUser } from "../../lib/auth";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type {
  CreateNightLogInput,
  Dj,
  NightLogResponse,
  Paginated,
  PlaceSuggestion,
  Review,
  SeriesSummary,
  SpotifyArtist,
  TagSummary,
  User,
  VenueSummary,
} from "../../lib/api/types";
import { formatTag, parseDateInputValue, toDateInputValue } from "../../lib/format";
import { ROUTES } from "../../lib/routes";
import { isIos } from "@/lib/utils";

type ICreateDjInput = {
  name: string;
  bio?: string;
  genres?: string[];
  spotifyId?: string;
  imageUrl?: string;
};

// An already-saved DJ, or one (from Spotify or typed in by hand) that gets
// created when the night is saved.
type IArtistPick = { type: "existing"; dj: Dj } | { type: "new"; input: ICreateDjInput };

// One DJ in the night's lineup. Rating them is optional; an unrated DJ is
// still saved to the lineup.
type ILineupEntry = {
  key: string;
  pick: IArtistPick;
  rating?: number;
  reviewText: string;
  expanded: boolean;
};

// An existing event series ("Innervisions"), or a new one created by name
// when the night is saved.
type ISeriesPick = { type: "existing"; series: SeriesSummary } | { type: "new"; name: string };

// An already-saved venue, a Google Places result (saved as a venue when the
// night is saved), or a name typed in by hand.
type IVenuePick =
  | { type: "existing"; venue: VenueSummary }
  | { type: "place"; place: PlaceSuggestion }
  | { type: "typed"; name: string };

// Form fields as typed; turned into the POST /logs body on submit. rating,
// tags and reviewText are the review of the night as a whole.
type IReviewDraft = {
  seriesPick?: ISeriesPick;
  venuePick?: IVenuePick;
  // Only asked for (and sent) for a typed-in venue; saved and Google venues
  // already know their city.
  city: string;
  seenAt: string;
  rating?: number;
  tags: string[];
  reviewText: string;
  taggedUsers: User[];
};

function emptyDraft(): IReviewDraft {
  return {
    city: "",
    seenAt: toDateInputValue(new Date()),
    tags: [],
    reviewText: "",
    taggedUsers: [],
  };
}

function artistPickName(pick: IArtistPick) {
  return pick.type === "existing" ? pick.dj.name : pick.input.name;
}

function artistPickKey(pick: IArtistPick) {
  if (pick.type === "existing") return `dj-${pick.dj.id}`;
  return pick.input.spotifyId ? `spotify-${pick.input.spotifyId}` : `new-${pick.input.name.toLowerCase()}`;
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
        {!!subtitle && (
          <Text numberOfLines={1} className="text-xs text-muted">
            {subtitle}
          </Text>
        )}
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
  // Skeleton only until the first rows land; once both searches settle with
  // nothing, say so instead of leaving an empty dropdown.
  const isFetching = isLocalFetching || isSpotifyFetching;
  const showSkeleton = isFetching && !rows.length;
  const showNoResults = !isFetching && !rows.length;

  return (
    <View>
      <TextInput
        placeholder="Add a DJ"
        value={value}
        onChangeText={onChangeText}
        className={INPUT_CLASS}
      />
      {enabled && (
        <View className="mt-1 overflow-hidden rounded-xl border border-primary/20 bg-white dark:bg-surface-dark">
          <ScrollView
            style={{ maxHeight: RESULT_ROW_HEIGHT * VISIBLE_RESULT_ROWS }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {showSkeleton && (
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
            )}
            {showNoResults && (
              <View
                style={{ height: RESULT_ROW_HEIGHT }}
                className="justify-center border-b border-muted/10 px-4"
              >
                <Text className="text-muted">No results found for &ldquo;{query}&rdquo;</Text>
              </View>
            )}
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
      )}
    </View>
  );
}

// A DJ in the lineup: tap "Rate" to give them their own stars and review.
function LineupEntryRow({
  entry,
  onChange,
  onEdit,
  onRemove,
}: {
  entry: ILineupEntry;
  onChange: (changes: Partial<ILineupEntry>) => void;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const { pick } = entry;
  const name = artistPickName(pick);
  const imageUrl = pick.type === "existing" ? pick.dj.imageUrl : pick.input.imageUrl;
  return (
    <View className="mb-2 rounded-xl border border-primary/20 bg-white p-3 dark:bg-surface-dark">
      <View className="flex-row items-center gap-3">
        <Avatar uri={imageUrl || null} name={name} size={40} />
        <View className="flex-1">
          <Text numberOfLines={1} className="font-semibold text-ink dark:text-paper">
            {name}
          </Text>
          {entry.rating ? (
            <RatingStars value={entry.rating} size={12} />
          ) : (
            <Text className="text-xs text-muted">Not rated</Text>
          )}
        </View>
        {onEdit && (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text className="text-sm text-muted">Edit</Text>
          </Pressable>
        )}
        <Pressable onPress={() => onChange({ expanded: !entry.expanded })} hitSlop={8}>
          <Text className="text-sm font-medium text-accent-text dark:text-accent-dark">
            {entry.expanded ? "Done" : entry.rating ? "Edit rating" : "Rate"}
          </Text>
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${name}`}>
          <Icon name="close" size={18} className="text-muted" />
        </Pressable>
      </View>
      {entry.expanded && (
        <View className="mt-3 border-t border-muted/10 pt-3">
          <View className="flex-row items-center justify-between">
            <RatingStars value={entry.rating} onChange={(rating) => onChange({ rating })} size={22} />
            {!!entry.rating && (
              <Pressable onPress={() => onChange({ rating: undefined })} hitSlop={8}>
                <Text className="text-xs text-muted">Clear</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            placeholder={`How was ${name}? (optional)`}
            value={entry.reviewText}
            onChangeText={(reviewText) => onChange({ reviewText })}
            multiline
            className={`mt-2 min-h-16 ${INPUT_CLASS}`}
          />
        </View>
      )}
    </View>
  );
}

// Search existing event series ("Innervisions") or create one by name.
function SeriesSearchInput({ onSelect }: { onSelect: (pick: ISeriesPick) => void }) {
  const [value, setValue] = useState("");
  const query = value.trim();
  const enabled = query.length > 1;
  const { data, isFetching } = useSeriesSearch(query, enabled);
  const results = enabled ? (data ?? []) : [];
  const exactMatch = results.some((s) => s.name.toLowerCase() === query.toLowerCase());

  return (
    <View>
      <TextInput
        placeholder="e.g. Innervisions, Boiler Room"
        value={value}
        onChangeText={setValue}
        className={INPUT_CLASS}
      />
      {enabled && (
        <View className="mt-1 overflow-hidden rounded-xl border border-primary/20 bg-white dark:bg-surface-dark">
          <ScrollView
            style={{ maxHeight: RESULT_ROW_HEIGHT * VISIBLE_RESULT_ROWS }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {results.map((series) => (
              <Pressable
                key={series.id}
                onPress={() => onSelect({ type: "existing", series })}
                style={{ height: RESULT_ROW_HEIGHT }}
                className="justify-center border-b border-muted/10 px-4 active:bg-primary-tint/40 dark:active:bg-primary/10"
              >
                <Text numberOfLines={1} className="text-ink dark:text-paper">
                  {series.name}
                </Text>
                <Text className="text-xs text-muted">
                  {series.nightCount} {series.nightCount === 1 ? "night" : "nights"} logged
                </Text>
              </Pressable>
            ))}
            {isFetching && !results.length && (
              <View
                style={{ height: RESULT_ROW_HEIGHT }}
                className="justify-center border-b border-muted/10 px-4"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-24" />
              </View>
            )}
          </ScrollView>
          {!exactMatch && (
            <Pressable
              onPress={() => onSelect({ type: "new", name: query })}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-primary-tint/40 dark:active:bg-primary/10"
            >
              <View className="h-10 w-10 items-center justify-center rounded-lg border border-dashed border-accent/60">
                <Text className="text-lg text-accent-text dark:text-accent-dark">+</Text>
              </View>
              <Text numberOfLines={1} className="flex-1 font-medium text-accent-text dark:text-accent-dark">
                Create event &ldquo;{query}&rdquo;
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function SelectedSeriesCard({ pick, onClear }: { pick: ISeriesPick; onClear: () => void }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-primary/20 bg-white px-4 py-3 dark:bg-surface-dark">
      <View className="flex-1">
        <Text numberOfLines={1} className="font-semibold text-ink dark:text-paper">
          {pick.type === "existing" ? pick.series.name : pick.name}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted">
          {pick.type === "existing"
            ? `${pick.series.nightCount} ${pick.series.nightCount === 1 ? "night" : "nights"} logged`
            : "New event"}
        </Text>
      </View>
      <Pressable onPress={onClear} hitSlop={8}>
        <Text className="text-sm text-muted">Change</Text>
      </Pressable>
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
  const [genresText, setGenresText] = useState(initial.genres?.join(", ") ?? "");
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
      genres: genresText
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
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
      {!!subtitle && (
        <Text numberOfLines={1} className="text-xs text-muted">
          {subtitle}
        </Text>
      )}
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
      {enabled && (
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
            {isFetching && (
              <View
                style={{ height: RESULT_ROW_HEIGHT }}
                className="justify-center border-b border-muted/10 px-4"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-56" />
              </View>
            )}
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
      )}
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
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const { data: results } = useUserSearch(trimmed, { minLength: 2 });

  const taggedIds = new Set(taggedUsers.map((u) => u.id));

  return (
    <View>
      {!!taggedUsers.length && (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {taggedUsers.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => onRemove(u.id)}
              className="flex-row items-center gap-1.5 rounded-full border border-accent/40 bg-accent-tint px-3 py-1.5 active:opacity-80 dark:bg-accent/20"
            >
              <Avatar uri={u.avatarUrl} name={u.username} size={16} />
              <Text className="text-accent-text dark:text-accent-dark">@{u.username}</Text>
              <Icon name="close" size={14} className="text-accent-text dark:text-accent-dark" />
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
      {trimmed.length > 1 && !!results?.length && (
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
                <Avatar uri={u.avatarUrl} name={u.username} size={28} />
                <View>
                  <Text className="text-ink dark:text-paper">{u.username}</Text>
                </View>
              </Pressable>
            ))}
        </View>
      )}
    </View>
  );
}

// Mirrors the server's domain.NormalizeTag/NormalizeTags limits, so what
// the picker shows is what gets saved.
const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 8;
const normalizeTag = (s: string) => s.trim().split(/\s+/).join(" ").toLowerCase();

// Pick tags from the shared library (most used first) or add a new one by
// typing it. Selected tags show as removable pills above the input.
function TagPicker({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const api = useApi();
  const [query, setQuery] = useState("");
  const typed = normalizeTag(query);
  const search = useDebouncedValue(typed, 200);

  const { data: library } = useQuery({
    queryKey: queryKeys.tags.list(search),
    queryFn: () => api.get<TagSummary[]>("/tags", { q: search }),
    placeholderData: keepPreviousData,
  });

  const atMax = tags.length >= MAX_TAGS;
  const suggestions = (library ?? []).filter((t) => !tags.includes(t.name));
  const canCreate =
    !!typed && !tags.includes(typed) && !library?.some((t) => t.name === typed);

  const add = (tag: string) => {
    if (atMax || !tag || tags.includes(tag)) return;
    onAdd(tag);
    setQuery("");
  };

  return (
    <View>
      {!!tags.length && (
        <View className="mb-2 flex-row flex-wrap gap-2">
          {tags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => onRemove(tag)}
              className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 active:opacity-80"
            >
              <Text className="text-paper">{formatTag(tag)}</Text>
              <Icon name="close" size={14} className="text-paper" />
            </Pressable>
          ))}
        </View>
      )}
      {atMax ? (
        <Text className="text-xs text-muted">That's the max of {MAX_TAGS} tags.</Text>
      ) : (
        <>
          <TextInput
            placeholder="Search tags or add your own"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => add(typed)}
            maxLength={MAX_TAG_LENGTH}
            autoCapitalize="none"
            returnKeyType="done"
            submitBehavior="submit"
            className={INPUT_CLASS}
          />
          {(canCreate || !!suggestions.length) && (
            <View className="mt-2 flex-row flex-wrap gap-2">
              {canCreate && (
                <Pressable
                  onPress={() => add(typed)}
                  className="flex-row items-center gap-1 rounded-full border border-dashed border-primary px-3 py-1.5 active:opacity-80"
                >
                  <Icon name="add" size={14} className="text-primary dark:text-primary-dark" />
                  <Text className="text-primary dark:text-primary-dark">Add "{typed}"</Text>
                </Pressable>
              )}
              {suggestions.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => add(t.name)}
                  className="rounded-full border border-primary/20 bg-white px-3 py-1.5 active:opacity-80 dark:bg-surface-dark"
                >
                  <Text className="text-ink dark:text-paper">{formatTag(t.name)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function CreateReviewScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();

  const { me } = useCurrentUser();

  const [djQuery, setDjQuery] = useState("");
  const [lineup, setLineup] = useState<ILineupEntry[]>([]);
  // Open for a new artist (null) or to edit a hand-made one in the lineup (its key).
  const [artistModal, setArtistModal] = useState<{ editingKey: string | null }>();
  const [draft, setDraft] = useState<IReviewDraft>(emptyDraft);
  const [placesSessionToken, setPlacesSessionToken] = useState(newPlacesSessionToken);
  const [error, setError] = useState<string>();

  const updateDraft = (changes: Partial<IReviewDraft>) =>
    setDraft((prev) => ({ ...prev, ...changes }));
  const updateEntry = (key: string, changes: Partial<ILineupEntry>) =>
    setLineup((prev) => prev.map((e) => (e.key === key ? { ...e, ...changes } : e)));

  const addToLineup = (pick: IArtistPick) => {
    const key = artistPickKey(pick);
    setLineup((prev) =>
      prev.some((e) => e.key === key) ? prev : [...prev, { key, pick, reviewText: "", expanded: false }],
    );
    setDjQuery("");
  };

  const createDj = useMutation({
    mutationFn: (input: ICreateDjInput) => api.post<Dj>("/djs", input),
  });
  const createLog = useMutation({
    mutationFn: (input: CreateNightLogInput) => api.post<NightLogResponse>("/logs", input),
  });

  const resetForm = () => {
    setDjQuery("");
    setLineup([]);
    setDraft(emptyDraft());
    setPlacesSessionToken(newPlacesSessionToken());
    setError(undefined);
  };

  const pending = createDj.isPending || createLog.isPending;
  const anyDjRated = lineup.some((e) => !!e.rating);

  const onSubmit = async () => {
    setError(undefined);
    if (!me) {
      setError("Must be logged in to create a review");
      return;
    }
    const { venuePick } = draft;
    if (!venuePick) {
      setError("Pick the venue you were at");
      return;
    }
    const seenAtDate = parseDateInputValue(draft.seenAt);
    if (!seenAtDate) {
      setError("Pick the date you went");
      return;
    }
    // The picker caps at today, but a date can still be typed in on web.
    // YYYY-MM-DD strings compare correctly as plain strings.
    if (draft.seenAt > toDateInputValue(new Date())) {
      setError("You can't log a set that hasn't happened yet");
      return;
    }
    // Midday local time, so the stored instant reads back as the same
    // calendar day in any time zone (UTC midnight shows as the day before
    // across the Americas).
    seenAtDate.setHours(12);
    if (!draft.rating && !anyDjRated) {
      setError("Rate the night, or at least one DJ");
      return;
    }
    if (!draft.rating && draft.reviewText.trim()) {
      setError("Rate the night to save what you wrote about it");
      return;
    }
    const unratedWithText = lineup.find((e) => !e.rating && e.reviewText.trim());
    if (unratedWithText) {
      setError(`Rate ${artistPickName(unratedWithText.pick)} to save what you wrote about them`);
      return;
    }

    try {
      // Save new artists first. Each one swaps into the lineup as saved, so
      // a retry after a failed log doesn't create it twice.
      const djsByKey = new Map<string, Dj>();
      for (const entry of lineup) {
        if (entry.pick.type === "existing") {
          djsByKey.set(entry.key, entry.pick.dj);
          continue;
        }
        const dj = await createDj.mutateAsync(entry.pick.input);
        djsByKey.set(entry.key, dj);
        updateEntry(entry.key, { pick: { type: "existing", dj } });
      }
      const djFor = (entry: ILineupEntry) => djsByKey.get(entry.key)!;
      const rated = lineup.filter((e) => !!e.rating);

      const { seriesPick } = draft;
      const result = await createLog.mutateAsync({
        ...(seriesPick?.type === "existing"
          ? { seriesId: seriesPick.series.id }
          : seriesPick?.type === "new"
            ? { seriesName: seriesPick.name }
            : {}),
        ...(venuePick.type === "existing"
          ? { venueId: venuePick.venue.id }
          : venuePick.type === "place"
            ? { placeId: venuePick.place.placeId, placeSessionToken: placesSessionToken }
            : { venue: venuePick.name, city: draft.city.trim() || undefined }),
        seenAt: seenAtDate.toISOString(),
        lineupDjIds: lineup.map((e) => djFor(e).id),
        night: draft.rating
          ? { rating: draft.rating, reviewText: draft.reviewText.trim() || undefined }
          : undefined,
        djReviews: rated.map((e) => ({
          djId: djFor(e).id,
          rating: e.rating!,
          reviewText: e.reviewText.trim() || undefined,
        })),
        tags: draft.tags,
        taggedUserIds: draft.taggedUsers.map((u) => u.id),
      });

      // The response only carries bare rows; seed the profile list and the
      // detail pages with full reviews so they render instantly instead of
      // waiting on a background refetch. Tags and friends land on the night
      // review, or on every DJ review when the night wasn't rated (as the
      // server does).
      const djsById = new Map([...djsByKey.values()].map((dj) => [dj.id, dj]));
      const fullReviews: Review[] = result.reviews.map((r, i) => {
        const carriesTags = !draft.rating || i === 0;
        return {
          ...r,
          dj: r.djId ? djsById.get(r.djId) : undefined,
          event: result.event,
          user: me,
          taggedUsers: carriesTags ? draft.taggedUsers : [],
          tags: carriesTags ? [...draft.tags].sort() : [],
          likeCount: 0,
          commentCount: 0,
          isLikedByMe: false,
        };
      });
      const reviewsKey = queryKeys.reviews.byUser(me.username);
      // Profiles list newest-seen first, so slot them in by seenAt rather
      // than at the top (a set seen last month belongs below last week's).
      queryClient.setQueryData<Paginated<Review>>(reviewsKey, (old) => ({
        items: [...fullReviews, ...(old?.items ?? [])].sort(
          (a, b) => new Date(b.seenAt).getTime() - new Date(a.seenAt).getTime(),
        ),
        nextCursor: old?.nextCursor ?? null,
      }));
      for (const review of fullReviews) {
        queryClient.setQueryData<Review>(queryKeys.reviews.byId(review.id), review);
      }

      const { event } = result;
      queryClient.invalidateQueries({ queryKey: reviewsKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(me.username) });
      for (const dj of djsById.values()) {
        queryClient.invalidateQueries({ queryKey: queryKeys.djs.bySlug(dj.slug) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.events.byId(event.id) });
      if (event.venueId) queryClient.invalidateQueries({ queryKey: queryKeys.venues.byId(event.venueId) });
      queryClient.invalidateQueries({ queryKey: ["venues", "search"] });
      queryClient.invalidateQueries({ queryKey: ["series"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.activity() });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.popular() });
      queryClient.invalidateQueries({ queryKey: ["tags"] });

      // The tab stays mounted behind the review page, so clear it for the
      // next log rather than leaving this one's answers filled in on back.
      resetForm();
      // The night review comes first when there is one.
      router.push(ROUTES.REVIEW_DETAIL(result.reviews[0].id, { justLogged: true }));
    } catch (err: any) {
      setError(err?.message ?? "Could not save your review");
    }
  };

  const editingEntry = lineup.find((e) => e.key === artistModal?.editingKey);

  return (
    <Page title="Review a Set">
      <KeyboardAvoidingView behavior={isIos ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled">
          <Text className="mb-1 text-sm font-medium text-muted">Event (optional)</Text>
          <View className="mb-4">
            {draft.seriesPick ? (
              <SelectedSeriesCard
                pick={draft.seriesPick}
                onClear={() => updateDraft({ seriesPick: undefined })}
              />
            ) : (
              <SeriesSearchInput onSelect={(seriesPick) => updateDraft({ seriesPick })} />
            )}
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Venue</Text>
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
            {draft.venuePick?.type === "typed" && (
              <TextInput
                placeholder="City"
                value={draft.city}
                onChangeText={(city) => updateDraft({ city })}
                className={`mt-2 ${INPUT_CLASS}`}
              />
            )}
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Date</Text>
          <View className="mb-4">
            <DateInput
              value={draft.seenAt}
              onChange={(seenAt) => updateDraft({ seenAt })}
              maximumDate={new Date()}
              className={INPUT_CLASS}
            />
          </View>

          <Text className="text-sm font-medium text-muted">DJs you saw</Text>
          <Text className="mb-2 text-xs text-muted">
            Add everyone you caught. Rating each one is optional.
          </Text>
          <View className="mb-4">
            {lineup.map((entry) => (
              <LineupEntryRow
                key={entry.key}
                entry={entry}
                onChange={(changes) => updateEntry(entry.key, changes)}
                // Only hand-made artists (not yet saved, not from Spotify) are editable.
                onEdit={
                  entry.pick.type === "new" && !entry.pick.input.spotifyId
                    ? () => setArtistModal({ editingKey: entry.key })
                    : undefined
                }
                onRemove={() => setLineup((prev) => prev.filter((e) => e.key !== entry.key))}
              />
            ))}
            <ArtistSearchInput
              value={djQuery}
              onChangeText={setDjQuery}
              onSelect={addToLineup}
              onCreate={() => setArtistModal({ editingKey: null })}
            />
          </View>
          {artistModal && (
            // Mounted only while open so the form re-seeds from the current
            // search text / artist each time it opens.
            <CreateArtistModal
              visible
              initial={
                editingEntry?.pick.type === "new" ? editingEntry.pick.input : { name: djQuery.trim() }
              }
              onClose={() => setArtistModal(undefined)}
              onSave={(input) => {
                if (editingEntry) {
                  updateEntry(editingEntry.key, { pick: { type: "new", input } });
                } else {
                  addToLineup({ type: "new", input });
                }
                setArtistModal(undefined);
              }}
            />
          )}

          <View className="mb-4 border-t border-primary/15 pt-4">
            <Text className="text-base font-semibold text-ink dark:text-paper">The night overall</Text>
            <Text className="text-xs text-muted">
              {anyDjRated
                ? "Optional, since you rated a DJ."
                : "Required, unless you rate at least one DJ."}
            </Text>
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Rating</Text>
          <View className="mb-4 flex-row items-center justify-between">
            <RatingStars value={draft.rating} onChange={(rating) => updateDraft({ rating })} size={22} />
            {!!draft.rating && anyDjRated && (
              <Pressable onPress={() => updateDraft({ rating: undefined })} hitSlop={8}>
                <Text className="text-xs text-muted">Clear</Text>
              </Pressable>
            )}
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Tags (optional)</Text>
          <View className="mb-4">
            <TagPicker
              tags={draft.tags}
              onAdd={(tag) => setDraft((prev) => ({ ...prev, tags: [...prev.tags, tag] }))}
              onRemove={(tag) =>
                setDraft((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
              }
            />
          </View>

          <Text className="mb-1 text-sm font-medium text-muted">Review</Text>
          <TextInput
            placeholder="How was the night?"
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
              {pending ? "Saving..." : "Save"}
            </Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}
