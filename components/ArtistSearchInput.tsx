import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Text } from "./Text";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { Dj, SpotifyArtist } from "../lib/api/types";

export type ArtistPick =
  | { type: "existing"; dj: Dj }
  | { type: "spotify"; artist: SpotifyArtist };

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
