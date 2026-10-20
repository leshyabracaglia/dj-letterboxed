import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";

import { TrackRow } from "@/components/TrackRow";
import { Button, DashedButton, Icon, KEYBOARD_DISMISS_PROPS, Sheet, Text } from "@/components/ui";
import { errorMessage, unwrap, useApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queryKeys";
import type { TrackMatch } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { artistPickName, type DraftLineupEntry, type DraftTrack, draftTrackDisplay } from "./draft";
import {
  CircleIcon,
  FieldLabel,
  INPUT_CLASS,
  LinedInput,
  SearchField,
  SheetRow,
  SheetSectionLabel,
  SheetSkeletonRow,
} from "./fields";

// What the search box holds looks like a pasted link rather than a search.
function looksLikeLink(text: string) {
  return /^https?:\/\//i.test(text);
}

let nextTrackKey = 0;
function newTrackKey() {
  nextTrackKey += 1;
  return `track-${Date.now()}-${nextTrackKey}`;
}

// Adding a track to the night: search Spotify or paste a Spotify, SoundCloud,
// Apple Music or Shazam link, or type one in by hand (or say you don't know
// what it was); then who played it and a note on why it stuck. Editing a
// track opens straight on that second step.
export function TrackSheet({
  editing,
  djKey,
  lineup,
  onSave,
  onClose,
}: {
  editing?: DraftTrack;
  // Who it starts as played by: the DJ card it was added from, or (none)
  // the night as a whole.
  djKey?: string;
  // The DJs caught, any of whom could have played it.
  lineup: DraftLineupEntry[];
  onSave: (track: DraftTrack) => void;
  onClose: () => void;
}) {
  const [track, setTrack] = useState<DraftTrack | undefined>(editing);
  return (
    <Sheet title={editing ? "Edit track" : "Add a track"} tag="Optional" onClose={onClose}>
      {track ? (
        <TrackDetails track={track} lineup={lineup} onChange={setTrack} onSave={() => onSave(track)} />
      ) : (
        <FindTrack
          onPick={(picked) => setTrack({ key: newTrackKey(), djKey, title: "", artist: "", note: "", ...picked })}
        />
      )}
    </Sheet>
  );
}

// Step one: the search box, which reads a pasted link instead of searching.
function FindTrack({ onPick }: { onPick: (track: Partial<DraftTrack>) => void }) {
  const api = useApi();
  const [value, setValue] = useState("");
  const typed = value.trim();
  const isLink = looksLikeLink(typed);
  const query = useDebouncedValue(typed, 250);

  const search = useQuery({
    queryKey: queryKeys.tracks.search(query),
    queryFn: () => unwrap(api.GET("/api/tracks/search", { params: { query: { q: query } } })),
    enabled: !isLink && query.length > 1,
  });
  const link = useQuery({
    queryKey: queryKeys.tracks.resolve(typed),
    queryFn: () => unwrap(api.GET("/api/tracks/resolve", { params: { query: { url: typed } } })),
    enabled: isLink,
    retry: false,
  });

  const results: TrackMatch[] = isLink ? (link.data ? [link.data] : []) : (search.data ?? []);
  const loading = isLink ? link.isFetching : search.isFetching;

  return (
    <>
      <SearchField
        value={value}
        onChangeText={setValue}
        placeholder="Search, or paste a Spotify/SoundCloud/Shazam link"
      />
      <ScrollView className="mt-3 shrink" {...KEYBOARD_DISMISS_PROPS}>
        {!typed && (
          <Text className="px-4 pb-2 text-sm text-paper/60">
            Paste a link from Spotify, SoundCloud, Apple Music or Shazam - your Shazam history&apos;s share button gives
            you one.
          </Text>
        )}
        {loading && !results.length && <SheetSkeletonRow />}
        {isLink && link.isError && (
          <Text className="px-4 pb-2 text-sm text-danger-dark">
            {errorMessage(link.error, "Couldn't read that link")}. You can add it by hand below.
          </Text>
        )}
        {results.map((match) => (
          <SheetRow
            key={`${match.source}-${match.externalId}`}
            left={
              match.artworkUrl ? (
                <Image source={{ uri: match.artworkUrl }} style={{ width: 32, height: 32 }} />
              ) : (
                <CircleIcon name="musical-notes" />
              )
            }
            title={match.title}
            subtitle={match.artist}
            onPress={() => onPick({ match })}
          />
        ))}
        {!!typed && !isLink && (
          <SheetRow
            left={<CircleIcon name="add" />}
            title={`Add “${typed}” by hand`}
            subtitle="Not on Spotify? An unreleased edit, a white label"
            plain
            onPress={() => onPick({ title: typed })}
          />
        )}
        <SheetSectionLabel>Don&apos;t know what it was?</SheetSectionLabel>
        <SheetRow
          left={<CircleIcon name="help" />}
          title="It's an ID"
          subtitle="Describe it - someone else who was there might know"
          plain
          onPress={() => onPick({})}
        />
      </ScrollView>
    </>
  );
}

// Step two: the track (title and artist, if typed in), who played it, and
// the note.
function TrackDetails({
  track,
  lineup,
  onChange,
  onSave,
}: {
  track: DraftTrack;
  lineup: DraftLineupEntry[];
  onChange: (track: DraftTrack) => void;
  onSave: () => void;
}) {
  const [error, setError] = useState<string>();
  const set = (changes: Partial<DraftTrack>) => onChange({ ...track, ...changes });
  const typedIn = !track.match;
  const unidentified = typedIn && !track.title.trim();

  const save = () => {
    if (unidentified && !track.note.trim()) {
      setError("Say something about it, so others can help name it");
      return;
    }
    onSave();
  };

  return (
    <ScrollView className="shrink" contentContainerClassName="gap-4 px-4 pb-2" {...KEYBOARD_DISMISS_PROPS}>
      {typedIn ? (
        <>
          <View className="gap-1">
            <FieldLabel>Track (leave blank for an ID)</FieldLabel>
            <TextInput
              placeholder="Title"
              value={track.title}
              onChangeText={(title) => set({ title })}
              className={INPUT_CLASS}
            />
          </View>
          {!unidentified && (
            <View className="gap-1">
              <FieldLabel>Artist (optional)</FieldLabel>
              <TextInput
                placeholder="Who made it"
                value={track.artist}
                onChangeText={(artist) => set({ artist })}
                className={INPUT_CLASS}
              />
            </View>
          )}
        </>
      ) : (
        <TrackRow track={draftTrackDisplay(track)} showNote={false} />
      )}

      {!!lineup.length && (
        <View className="gap-2">
          <FieldLabel>Who played it</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {lineup.map((entry) => (
              <PlayedByChip
                key={entry.key}
                label={artistPickName(entry.pick)}
                selected={track.djKey === entry.key}
                onPress={() => set({ djKey: entry.key })}
              />
            ))}
            <PlayedByChip label="Not sure" selected={!track.djKey} onPress={() => set({ djKey: undefined })} />
          </View>
        </View>
      )}

      <View className="gap-1">
        <FieldLabel>{unidentified ? "What was it like" : "Why this one"}</FieldLabel>
        <LinedInput
          value={track.note}
          onChangeText={(note) => {
            setError(undefined);
            set({ note });
          }}
          placeholder={
            unidentified
              ? "Vocal house, a sax line, played around 3am…"
              : "When it dropped, and what happened in the room"
          }
          lines={3}
        />
      </View>

      {!!error && <Text className="text-danger-dark">{error}</Text>}
      <Button onPress={save} className="py-3">
        <Text variant="display" className="text-xl text-paper">
          Save track
        </Text>
      </Button>
    </ScrollView>
  );
}

function PlayedByChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`border-2 px-3 py-1.5 active:opacity-80 ${selected ? "border-paper bg-zine-purple" : "border-paper/30"}`}
    >
      <Text variant="display" className={`text-base ${selected ? "text-paper" : "text-paper/70"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

// The tracks on a DJ's card (or the night's), each tappable to edit, and a
// dashed button to add another while there's room.
export function DraftTrackList({
  tracks,
  canAdd,
  addLabel,
  onAdd,
  onEdit,
  onRemove,
}: {
  tracks: DraftTrack[];
  canAdd: boolean;
  addLabel: string;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <View className="gap-3">
      {tracks.map((track) => (
        <Pressable
          key={track.key}
          onPress={() => onEdit(track.key)}
          accessibilityHint="Edit this track"
          className="bg-black/20 p-3 active:opacity-80"
        >
          <TrackRow
            track={draftTrackDisplay(track)}
            trailing={
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onRemove(track.key);
                }}
                hitSlop={8}
                accessibilityLabel="Remove track"
              >
                <Icon name="close" size={18} className="text-paper/80" />
              </Pressable>
            }
          />
        </Pressable>
      ))}
      {canAdd && (
        <DashedButton
          label={addLabel}
          icon="musical-notes"
          onPress={onAdd}
          className="border-paper/70 bg-black/15 py-2"
        />
      )}
    </View>
  );
}
