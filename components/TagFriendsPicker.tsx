import { useState } from "react";
import { Pressable, View } from "react-native";

import { Avatar, DashedButton, Icon, Text, TextField } from "./ui";
import { useUserSearch } from "../lib/api/hooks";
import { useCurrentUser } from "../lib/auth";
import type { User } from "../lib/api/types";

function TaggedUserChip({
  taggedUser,
  onRemoveTaggedUser,
}: {
  taggedUser: User;
  onRemoveTaggedUser: (userId: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onRemoveTaggedUser(taggedUser.id)}
      accessibilityLabel={`Untag @${taggedUser.username}`}
      className="flex-row items-center gap-1.5 bg-zine-purple px-2 py-1 active:opacity-80"
    >
      <Avatar uri={taggedUser.avatarUrl} name={taggedUser.username} size={18} />
      <Text className="font-display text-base uppercase leading-5 text-paper">@{taggedUser.username}</Text>
      <Icon name="close" size={14} className="text-paper" />
    </Pressable>
  );
}

/** Friends tagged as being at a night out, as removable chips, plus a
 * username search to tag more.  */
export function TagFriendsPicker({
  taggedUsers,
  onAdd,
  onRemoveTaggedUser,
  startTyping = false,
}: {
  taggedUsers: User[];
  onAdd: (user: User) => void;
  onRemoveTaggedUser: (userId: string) => void;
  startTyping?: boolean;
}) {
  const { me } = useCurrentUser();

  const [typing, setTyping] = useState(startTyping);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const { data: results } = useUserSearch(trimmed, { minLength: 2 });

  const taggedIds = new Set(taggedUsers.map((u) => u.id));
  // You can't tag yourself.
  const matches = (results ?? []).filter((user) => !taggedIds.has(user.id) && user.id !== me?.id);

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {taggedUsers.map((taggedUser) => (
          <TaggedUserChip key={taggedUser.id} taggedUser={taggedUser} onRemoveTaggedUser={onRemoveTaggedUser} />
        ))}
        {!typing && <DashedButton label="Tag a friend" onPress={() => setTyping(true)} />}
      </View>
      {typing && (
        <TextField
          autoFocus
          placeholder="Search by username"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          className="mt-2"
        />
      )}
      {typing && trimmed.length > 1 && !!matches.length && (
        <View className="border-x-2 border-b-2 border-white/15 bg-zine-panel">
          {matches.map((matchedUser) => (
            <Pressable
              key={matchedUser.id}
              onPress={() => {
                onAdd(matchedUser);
                setQuery("");
              }}
              className="flex-row items-center gap-2 border-b border-white/10 px-4 py-3 active:bg-zine-purple/20"
            >
              <Avatar uri={matchedUser.avatarUrl} name={matchedUser.username} size={28} />
              <Text className="text-paper">{matchedUser.username}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
