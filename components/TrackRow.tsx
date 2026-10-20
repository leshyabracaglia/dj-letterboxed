import type { ReactNode } from "react";
import { Image, Linking, Pressable, View } from "react-native";

import { Icon, Text } from "./ui";
import type { ReviewTrack } from "@/lib/api/types";

/** What a track row shows; a review's track, a search result, or a draft
 * one all fit. */
export type TrackLike = Pick<ReviewTrack, "title" | "artist" | "artworkUrl" | "url" | "source" | "note">;

const SOURCE_LABELS: Record<string, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple: "Apple Music",
  shazam: "Shazamed",
};

const ART_SIZE = 44;

/** A track's name: its title, or for an unidentified one "ID". */
export function trackTitle(track: Pick<ReviewTrack, "title">): string {
  return track.title || "ID";
}

/** A track: cover art, title and artist, where it's from, and the note
 * someone wrote about it. Opens its link, if it has one. `trailing` sits on
 * the right (a pick count, a remove button). `showNote` false leaves the note
 * out (search results). */
export function TrackRow({
  track,
  trailing,
  showNote = true,
  noteLines,
}: {
  track: TrackLike;
  trailing?: ReactNode;
  showNote?: boolean;
  // Clamp the note (list cards); unset shows all of it.
  noteLines?: number;
}) {
  const { url } = track;
  const from = SOURCE_LABELS[track.source];
  const subtitle = [track.title ? track.artist : "Unidentified", from].filter(Boolean).join(" · ");
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-3">
        <Pressable
          disabled={!url}
          onPress={(e) => {
            e.stopPropagation();
            if (url) Linking.openURL(url);
          }}
          accessibilityRole={url ? "link" : undefined}
          accessibilityLabel={url ? `Listen to ${trackTitle(track)}${from ? ` on ${from}` : ""}` : undefined}
          className="flex-1 flex-row items-center gap-3 active:opacity-70"
        >
          {track.artworkUrl ? (
            <Image
              source={{ uri: track.artworkUrl }}
              style={{ width: ART_SIZE, height: ART_SIZE }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              className="items-center justify-center border border-paper/30 bg-black/30"
              style={{ width: ART_SIZE, height: ART_SIZE }}
            >
              <Icon name={track.title ? "musical-notes" : "help"} size={20} className="text-paper/70" />
            </View>
          )}
          <View className="flex-1">
            <Text variant="display" className="text-lg leading-5 text-paper" numberOfLines={2}>
              {trackTitle(track)}
            </Text>
            {!!subtitle && (
              <Text className="text-xs text-paper/70" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </Pressable>
        {trailing}
      </View>
      {showNote && !!track.note && (
        <Text className="text-sm italic leading-5 text-paper/90" numberOfLines={noteLines}>
          “{track.note}”
        </Text>
      )}
    </View>
  );
}
