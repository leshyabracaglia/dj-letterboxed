import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { DashedButton, Text } from "../ui";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { TagSummary } from "../../lib/api/types";
import { INPUT_CLASS } from "./fields";

// ---- The night overall -------------------------------------------------

// Mirrors the server's domain.NormalizeTag/NormalizeTags limits, so what
// the picker shows is what gets saved.
const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 8;
const normalizeTag = (s: string) => s.trim().split(/\s+/).join(" ").toLowerCase();

// The default tags (most used first) as chips that stay put: tap one
// to fill it, again to clear it. "+ Tag" filters them as you type, or adds
// your own.
export function TagPicker({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const api = useApi();
  const [typing, setTyping] = useState(false);
  const [query, setQuery] = useState("");
  const typed = normalizeTag(query);

  const { data: library } = useQuery({
    queryKey: queryKeys.tags.list(""),
    queryFn: () => api.get<TagSummary[]>("/tags", { limit: 50 }),
  });

  const atMax = tags.length >= MAX_TAGS;
  // Only the curated defaults are offered; anything else is typed in.
  const names = (library ?? []).filter((t) => t.isDefault).map((t) => t.name);
  // Your own new tags sit after the library ones.
  const all = [...names, ...tags.filter((t) => !names.includes(t))];
  const shown = typed ? all.filter((t) => t.includes(typed)) : all;
  const canCreate = !!typed && !all.includes(typed);

  const toggle = (tag: string) => {
    if (tags.includes(tag)) return onRemove(tag);
    if (atMax || !tag) return;
    onAdd(tag);
    setQuery("");
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {shown.map((tag) => {
          const selected = tags.includes(tag);
          const disabled = !selected && atMax;
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              className={`border-2 px-1.5 py-0.5 active:opacity-80 ${
                selected ? "border-paper bg-paper" : "border-paper/50"
              } ${disabled ? "opacity-40" : ""}`}
            >
              <Text className={`font-display text-base uppercase leading-5 ${selected ? "text-ink" : "text-paper/80"}`}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
        {!atMax && !typing && <DashedButton label="Tag" onPress={() => setTyping(true)} />}
      </View>
      {atMax && <Text className="mt-2 text-xs text-paper/60">That's the max of {MAX_TAGS} tags.</Text>}
      {!atMax && typing && (
        <View className="mt-2 flex-row items-center gap-2">
          <TextInput
            autoFocus
            placeholder="Filter tags or add your own"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => canCreate && toggle(typed)}
            maxLength={MAX_TAG_LENGTH}
            autoCapitalize="none"
            returnKeyType="done"
            submitBehavior="submit"
            className={`flex-1 ${INPUT_CLASS}`}
          />
          {canCreate && <DashedButton label={`Add "${typed}"`} onPress={() => toggle(typed)} className="py-2" />}
        </View>
      )}
    </View>
  );
}
