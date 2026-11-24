import type { ReactNode } from "react";
import { Image, Linking, Pressable, View } from "react-native";

import { Icon, Stamp, Text } from "./ui";
import type { ReviewTrack } from "@/lib/api/types";
import { pluralWord } from "@/lib/format";

/** What a track row shows; a review's track, a search result, or a draft
 * one all fit. */
type TrackLike = Pick<ReviewTrack, "title" | "artist" | "artworkUrl" | "url" | "source" | "note"> & {
  identifiedBy?: ReviewTrack["identifiedBy"];
  suggestions?: ReviewTrack["suggestions"];
  clipDurationMs?: ReviewTrack["clipDurationMs"];
};

// Text colors for a row on the dark or violet papers, or (`light`) on a
// white panel, where an open ID sits on a night's card.
const TONES = {
  dark: { title: "text-paper", sub: "text-paper/70", note: "text-paper/90", box: "border-paper/30 bg-black/30" },
  light: { title: "text-ink", sub: "text-ink/60", note: "text-ink/80", box: "border-ink/70 border-dashed" },
} as const;

const SOURCE_LABELS: Record<string, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple: "Apple Music",
  shazam: "Shazamed",
};

const ART_SIZE = 44;

/** A track's name: its title, or for an unidentified one "ID". */
function trackTitle(track: Pick<ReviewTrack, "title">): string {
  return track.title || "ID";
}

/** A track: cover art, title and artist, where it's from, and the note
 * someone wrote about it. Opens its link, if it has one. `trailing` sits on
 * the right (a pick count, a remove button); an ID someone else named gets
 * an "ID'D" stamp there instead, crediting them. An open ID says how many
 * suggestions it has and whether there's a clip. `showNote` false leaves the
 * note out (search results); `light` is for a white panel. */
export function TrackRow({
  track,
  trailing,
  showNote = true,
  noteLines,
  light = false,
}: {
  track: TrackLike;
  trailing?: ReactNode;
  showNote?: boolean;
  // Clamp the note (list cards); unset shows all of it.
  noteLines?: number;
  light?: boolean;
}) {
  const tone = TONES[light ? "light" : "dark"];
  const { url } = track;
  const from = SOURCE_LABELS[track.source];
  const { identifiedBy } = track;
  const suggested = track.suggestions?.length ?? 0;
  const subtitle = [
    track.title ? track.artist : suggested ? `${suggested} ${pluralWord(suggested, "suggestion")}` : "Unidentified",
    !track.title && !!track.clipDurationMs && "Clip attached",
    from,
    identifiedBy && `ID'd by @${identifiedBy.username}`,
  ]
    .filter(Boolean)
    .join(" · ");
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
              className={`items-center justify-center border ${tone.box}`}
              style={{ width: ART_SIZE, height: ART_SIZE }}
            >
              {track.title ? (
                <Icon name="musical-notes" size={20} className="text-paper/70" />
              ) : (
                <Text variant="display" className={`text-lg ${tone.title}`}>
                  ID
                </Text>
              )}
            </View>
          )}
          <View className="flex-1">
            <Text variant="display" className={`text-lg leading-5 ${tone.title}`} numberOfLines={2}>
              {trackTitle(track)}
            </Text>
            {!!subtitle && (
              <Text className={`text-xs ${tone.sub}`} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </Pressable>
        {trailing ??
          (!!identifiedBy && (
            <Stamp
              label="ID'D"
              rim={`@${identifiedBy.username} · `}
              size={44}
              color="purple"
              rotate={-10}
              accessibilityLabel={`Named by @${identifiedBy.username}`}
            />
          ))}
      </View>
      {showNote && !!track.note && (
        <Text className={`text-sm italic leading-5 ${tone.note}`} numberOfLines={noteLines}>
          “{track.note}”
        </Text>
      )}
    </View>
  );
}
