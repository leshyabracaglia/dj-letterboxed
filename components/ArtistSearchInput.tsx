import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { useTRPC } from "../hooks/trpc";
import type { Dj } from "../lib/db/schema";

export type SpotifyArtistResult = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
};

export type ArtistPick =
  | { type: "existing"; dj: Dj }
  | { type: "spotify"; artist: SpotifyArtistResult };

export function ArtistSearchInput({
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
  const trpc = useTRPC();
  const query = value.trim();
  const enabled = query.length > 1 && !hasSelection;

  const { data: localResults, isFetching: isLocalFetching } = useQuery({
    ...trpc.djs.search.queryOptions({ query }),
    enabled,
  });
  const { data: spotifyResults, isFetching: isSpotifyFetching } = useQuery({
    ...trpc.djs.searchSpotify.queryOptions({ query }),
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
        className="rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      {showDropdown ? (
        <View className="mt-1 overflow-hidden rounded-lg border border-muted/30 bg-white">
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
              <Text className="text-ink">{dj.name}</Text>
              <Text className="text-xs text-muted">Already on Beatboxd</Text>
            </Pressable>
          ))}
          {(spotifyResults ?? []).map((artist) => (
            <Pressable
              key={`spotify-${artist.spotifyId}`}
              onPress={() => onSelect({ type: "spotify", artist })}
              className="border-b border-muted/10 px-4 py-3"
            >
              <Text className="text-ink">{artist.name}</Text>
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
