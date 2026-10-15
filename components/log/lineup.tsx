import { useQuery } from "@tanstack/react-query";
import { type Ref, useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, useWindowDimensions, View } from "react-native";

import {
  Avatar,
  Button,
  Card,
  DashedButton,
  FitText,
  Icon,
  KEYBOARD_DISMISS_PROPS,
  paperAt,
  Photo,
  RatingStampPicker,
  Sheet,
  Skeleton,
  Tape,
  Text,
  tiltFor,
} from "../ui";
import { useApi } from "../../lib/api/client";
import { useDjSearch } from "../../lib/api/hooks";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj, SpotifyArtist } from "../../lib/api/types";
import { artistPickName, type IArtistPick, type ICreateDjInput, type ILineupEntry } from "./draft";
import { CircleIcon, FieldLabel, INPUT_CLASS, LinedInput, NO_WEB_OUTLINE, SheetRow } from "./fields";

// The night's DJs: ticking off a listed lineup, adding artists, and rating
// each set.

// Fixed row height so the dropdown can cap itself at exactly five rows.
const RESULT_ROW_HEIGHT = 64;
const VISIBLE_RESULT_ROWS = 5;

// "Who did you catch?": the listed lineup as checkboxes. Ticked DJs go on the
// log and get a card below to rate their set.
export function CaughtChecklist({ lineup, onToggle }: { lineup: ILineupEntry[]; onToggle: (key: string) => void }) {
  return (
    <View className="border border-white/10 bg-zine-panel/90">
      {lineup.map((entry) => (
        <Pressable
          key={entry.key}
          onPress={() => onToggle(entry.key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: entry.caught }}
          className="flex-row items-center gap-3 border-b border-white/10 px-3 py-3 active:bg-zine-purple/20"
        >
          <View
            className={`h-6 w-6 items-center justify-center border-2 ${
              entry.caught ? "border-primary-dark bg-zine-purple" : "border-paper/50"
            }`}
          >
            {entry.caught && <Icon name="checkmark" size={16} className="text-paper" />}
          </View>
          <Text numberOfLines={1} className="flex-1 font-display text-xl uppercase leading-6 text-paper">
            {artistPickName(entry.pick)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---- Rate the sets -----------------------------------------------------

const COMMUNITY_ADDED_LABEL = "Added by the community";

// Spotify-backed artists are the norm; only call out community-added ones.
function djSubtitle(dj: Dj) {
  const genres = dj.genres?.join(", ") ?? "";
  if (dj.spotifyId) return genres;
  return genres ? `${COMMUNITY_ADDED_LABEL} · ${genres}` : COMMUNITY_ADDED_LABEL;
}

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
      className="flex-row items-center gap-3 border-b border-white/10 px-4 active:bg-zine-purple/20"
    >
      <Avatar uri={imageUrl} name={name} size={40} />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-display text-lg uppercase leading-5 text-paper">
          {name}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={1} className="text-xs text-paper/60">
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function ArtistSearchInput({
  value,
  onChangeText,
  onSelect,
  onCreate,
  onCancel,
  inputRef,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (pick: IArtistPick) => void;
  onCreate: () => void;
  onCancel: () => void;
  inputRef: Ref<TextInput>;
}) {
  const api = useApi();
  const query = value.trim();
  const enabled = query.length > 1;

  const { data: localResults, isFetching: isLocalFetching } = useDjSearch(query, { enabled });
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
      <View className="flex-row items-center gap-2 border-2 border-paper/80 bg-ink px-3">
        <Icon name="search" size={16} className="text-paper/70" />
        <TextInput
          ref={inputRef}
          autoFocus
          placeholder="Search Spotify for a DJ"
          value={value}
          onChangeText={onChangeText}
          className="flex-1 py-3 text-paper placeholder:text-paper/40"
          style={NO_WEB_OUTLINE}
        />
        <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Stop adding a DJ">
          <Icon name="close" size={18} className="text-paper/70" />
        </Pressable>
      </View>
      {enabled && (
        <View className="border-x-2 border-b-2 border-paper/80 bg-zine-panel">
          <ScrollView
            style={{ maxHeight: RESULT_ROW_HEIGHT * VISIBLE_RESULT_ROWS }}
            nestedScrollEnabled
            {...KEYBOARD_DISMISS_PROPS}
          >
            {showSkeleton && (
              <View
                style={{ height: RESULT_ROW_HEIGHT }}
                className="flex-row items-center gap-3 border-b border-white/10 px-4"
              >
                <Skeleton className="h-10 w-10 rounded-lg" />
                <View>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </View>
              </View>
            )}
            {showNoResults && (
              <View style={{ height: RESULT_ROW_HEIGHT }} className="justify-center border-b border-white/10 px-4">
                <Text className="text-paper/60">No results found for &ldquo;{query}&rdquo;</Text>
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
          <SheetRow left={<CircleIcon name="add" />} title={`Create artist “${query}”`} plain onPress={onCreate} />
        </View>
      )}
    </View>
  );
}

// A DJ's photo full size over the page, to put a face to the name while
// rating them. Tap anywhere to close.
function PhotoLightbox({ uri, name, onClose }: { uri: string; name: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height * 0.6, 480);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close photo"
        className="flex-1 items-center justify-center bg-ink/90"
      >
        <Photo uri={uri} width={size} height={size} framed rotate={-2} />
        <Text className="mt-6 px-6 text-center font-display text-4xl uppercase text-paper">{name}</Text>
      </Pressable>
    </Modal>
  );
}

// A DJ in the lineup, on purple or red paper: their name and photo (tap to
// enlarge), a row of stamps to rate the set, and a box for a review of it.
export function LineupCard({
  entry,
  index,
  onChange,
  onEdit,
  onRemove,
}: {
  entry: ILineupEntry;
  index: number;
  onChange: (changes: Partial<ILineupEntry>) => void;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const { pick } = entry;
  const paper = paperAt(index);
  const name = artistPickName(pick);
  const imageUrl = pick.type === "existing" ? pick.dj.imageUrl : pick.input.imageUrl;
  const genres = (pick.type === "existing" ? pick.dj.genres : pick.input.genres) ?? [];
  const number = String(index + 1).padStart(2, "0");
  const [photoOpen, setPhotoOpen] = useState(false);

  return (
    <Card tint={paper.tint} torn tilt={tiltFor(entry.key, 0.8)} className="pb-5">
      <Tape style={{ top: -10, left: 24 }} rotate={-4} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-3">
            <Text className={`font-display text-sm uppercase ${paper.inkClassName}`}>
              DJ {number}
              {!entry.rating && " · Tap a stamp to rate"}
            </Text>
            {onEdit && (
              <Pressable onPress={onEdit} hitSlop={8}>
                <Text className={`font-display text-sm uppercase underline ${paper.inkClassName}`}>Edit</Text>
              </Pressable>
            )}
          </View>
          <View className="mt-2">
            <FitText fontSize={40} numberOfLines={2} className="text-paper">
              {name}
            </FitText>
          </View>
          {!!genres.length && (
            <Text numberOfLines={1} className={`font-display text-sm uppercase ${paper.inkClassName}`}>
              {genres.slice(0, 2).join(" · ")}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => setPhotoOpen(true)}
          disabled={!imageUrl}
          accessibilityLabel={`Enlarge ${name}'s photo`}
          className="active:opacity-80"
        >
          <Photo
            uri={imageUrl}
            width={72}
            height={80}
            framed
            rotate={3}
            placeholderClassName={paper.photoPlaceholderClassName}
            silhouetteClassName={paper.photoSilhouetteClassName}
          />
        </Pressable>
      </View>
      {photoOpen && !!imageUrl && <PhotoLightbox uri={imageUrl} name={name} onClose={() => setPhotoOpen(false)} />}

      <View className="mt-3 flex-row items-center justify-between border-t border-paper/25 pt-3">
        <RatingStampPicker value={entry.rating} onChange={(rating) => onChange({ rating })} size={40} />
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${name}`}>
          <Icon name="close" size={18} className="text-paper/80" />
        </Pressable>
      </View>

      {entry.reviewing || !!entry.reviewText ? (
        <View className="mt-3 gap-1 bg-black/20 p-3">
          <Text className={`font-display text-sm uppercase ${paper.inkClassName}`}>Your review of {name}</Text>
          <LinedInput
            value={entry.reviewText}
            onChangeText={(reviewText) => onChange({ reviewText })}
            placeholder={`How was ${name}'s set?`}
            lines={3}
            autoFocus={entry.reviewing}
          />
        </View>
      ) : (
        <DashedButton
          label={`Review ${name}'s set`}
          icon="pencil"
          onPress={() => onChange({ reviewing: true })}
          className="mt-3 border-paper/70 bg-black/15 py-2"
        />
      )}
    </Card>
  );
}

export function CreateArtistSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: ICreateDjInput;
  onClose: () => void;
  onSave: (draft: ICreateDjInput) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? undefined);
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
    <Sheet title="Add an artist" onClose={onClose}>
      <ScrollView className="shrink" contentContainerClassName="gap-3 px-4" {...KEYBOARD_DISMISS_PROPS}>
        <Text className="text-xs text-paper/60">They&apos;ll be added to Beatboxd when you save your log.</Text>
        <View className="mt-1 items-center">
          <Avatar uri={trimmedImageUrl || null} name={name || "?"} size={88} />
        </View>

        <View className="mt-1 gap-1">
          <FieldLabel>Name</FieldLabel>
          <TextInput placeholder="Artist name" value={name} onChangeText={setName} className={INPUT_CLASS} />
        </View>

        <View className="gap-1">
          <FieldLabel>Image link (optional)</FieldLabel>
          <TextInput
            placeholder="https://…"
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            className={INPUT_CLASS}
          />
        </View>

        <View className="gap-1">
          <FieldLabel>Genres (optional)</FieldLabel>
          <TextInput
            placeholder="techno, house, dubstep"
            value={genresText}
            onChangeText={setGenresText}
            autoCapitalize="none"
            className={INPUT_CLASS}
          />
        </View>

        <View className="gap-1">
          <FieldLabel>Quick bio (optional)</FieldLabel>
          <TextInput
            placeholder="A sentence or two about them"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            className={`min-h-20 ${INPUT_CLASS}`}
          />
        </View>

        {!!error && <Text className="text-danger-dark">{error}</Text>}
        <Button onPress={save} className="mt-1 py-3">
          <Text className="font-display text-xl uppercase text-paper">Add artist</Text>
        </Button>
      </ScrollView>
    </Sheet>
  );
}
