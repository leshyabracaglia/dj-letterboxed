import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { User } from "../lib/api/types";

export function TagFriendsPicker({
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
              className="flex-row items-center gap-1 rounded-full bg-ink px-3 py-1.5"
            >
              <Text className="text-paper">@{u.username} ✕</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        placeholder="Tag friends who were there"
        value={query}
        onChangeText={setQuery}
        className="rounded-lg border border-muted/30 bg-white px-4 py-3"
      />
      {trimmed.length > 1 && results && results.length > 0 ? (
        <View className="mt-1 overflow-hidden rounded-lg border border-muted/30 bg-white">
          {results
            .filter((u) => !taggedIds.has(u.id))
            .map((u) => (
              <Pressable
                key={u.id}
                onPress={() => {
                  onAdd(u);
                  setQuery("");
                }}
                className="border-b border-muted/10 px-4 py-3"
              >
                <Text className="text-ink">{u.displayName ?? u.username}</Text>
                <Text className="text-xs text-muted">@{u.username}</Text>
              </Pressable>
            ))}
        </View>
      ) : null}
    </View>
  );
}
