import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "./Text";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { User } from "../lib/api/types";
import { Avatar } from "./Avatar";

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
              className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-1.5"
            >
              <Avatar uri={u.avatarUrl} name={u.displayName ?? u.username} size={16} />
              <Text className="text-paper">@{u.username} ✕</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        placeholder="Tag friends who were there"
        value={query}
        onChangeText={setQuery}
        className="rounded-xl border border-primary/20 bg-white dark:bg-surface-dark px-4 py-3"
      />
      {trimmed.length > 1 && results && results.length > 0 ? (
        <View className="mt-1 overflow-hidden rounded-xl border border-primary/20 bg-white dark:bg-surface-dark">
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
