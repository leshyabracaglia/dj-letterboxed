import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Avatar, DashedButton, Icon, Text } from "./ui";
import { useUserSearch } from "../lib/api/hooks";
import type { User } from "../lib/api/types";

const INPUT_CLASS =
  "rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-3 text-ink dark:text-paper placeholder:text-muted";

/** Friends tagged as being at a night out, as removable chips, plus a
 * username search to tag more. Used when logging a night and, afterwards,
 * from the review page (who was there is the one thing editable later). */
export function TagFriendsPicker({
  taggedUsers,
  onAdd,
  onRemove,
  excludeUserId,
  startTyping = false,
}: {
  taggedUsers: User[];
  onAdd: (user: User) => void;
  onRemove: (userId: string) => void;
  /** Left out of the search results (yourself). */
  excludeUserId?: string;
  startTyping?: boolean;
}) {
  const [typing, setTyping] = useState(startTyping);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const { data: results } = useUserSearch(trimmed, { minLength: 2 });

  const taggedIds = new Set(taggedUsers.map((u) => u.id));
  const matches = (results ?? []).filter((u) => !taggedIds.has(u.id) && u.id !== excludeUserId);

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {taggedUsers.map((u) => (
          <Pressable
            key={u.id}
            onPress={() => onRemove(u.id)}
            accessibilityLabel={`Untag @${u.username}`}
            className="flex-row items-center gap-1.5 bg-zine-purple px-2 py-1 active:opacity-80"
          >
            <Avatar uri={u.avatarUrl} name={u.username} size={18} />
            <Text className="font-display text-base uppercase leading-5 text-paper">@{u.username}</Text>
            <Icon name="close" size={14} className="text-paper" />
          </Pressable>
        ))}
        {!typing && <DashedButton label="Tag a friend" onPress={() => setTyping(true)} />}
      </View>
      {typing && (
        <TextInput
          autoFocus
          placeholder="Search by username"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          className={`mt-2 ${INPUT_CLASS}`}
        />
      )}
      {typing && trimmed.length > 1 && !!matches.length && (
        <View className="border-x-2 border-b-2 border-white/15 bg-zine-panel">
          {matches.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => {
                onAdd(u);
                setQuery("");
              }}
              className="flex-row items-center gap-2 border-b border-white/10 px-4 py-3 active:bg-zine-purple/20"
            >
              <Avatar uri={u.avatarUrl} name={u.username} size={28} />
              <Text className="text-paper">{u.username}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
