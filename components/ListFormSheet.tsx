import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Button, KEYBOARD_DISMISS_PROPS, Sheet, Text, TextField } from "./ui";
import { errorMessage, unwrap, useApi } from "@/lib/api/client";
import type { ListSummary } from "@/lib/api/types";

type ListFields = Pick<ListSummary, "id" | "title" | "description">;

/** Starting a list, or (given `list`) renaming one: its title and an
 * optional description. `onSaved` gets the list as saved; every cached copy
 * of the caller's lists is refreshed. */
export function ListFormSheet({
  list,
  onSaved,
  onClose,
}: {
  list?: ListFields;
  onSaved: (list: ListFields) => void;
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(list?.title ?? "");
  const [description, setDescription] = useState(list?.description ?? "");

  const save = useMutation({
    mutationFn: () => {
      const body = { title, description: description.trim() || undefined };
      return list
        ? unwrap(api.PATCH("/api/lists/{id}", { params: { path: { id: list.id } }, body }))
        : unwrap(api.POST("/api/lists", { body }));
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      onSaved(saved);
    },
  });

  return (
    <Sheet title={list ? "Edit list" : "New list"} onClose={onClose}>
      <ScrollView className="shrink" contentContainerClassName="gap-3 px-4 pb-2" {...KEYBOARD_DISMISS_PROPS}>
        <View className="gap-1">
          <Text variant="display" className="text-base text-paper/60">
            Title
          </Text>
          <TextField
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="Best closing sets of 2026"
            maxLength={100}
          />
        </View>
        <View className="gap-1">
          <Text variant="display" className="text-base text-paper/60">
            What it&apos;s about (optional)
          </Text>
          <TextField
            value={description}
            onChangeText={setDescription}
            placeholder="The last hour is the whole night…"
            multiline
            maxLength={1000}
            className="min-h-20"
          />
        </View>
        {save.isError && <Text className="text-danger-dark">{errorMessage(save.error, "Couldn't save the list")}</Text>}
        <Button onPress={() => save.mutate()} disabled={!title.trim() || save.isPending} className="py-3">
          <Text variant="display" className="text-xl text-paper">
            {save.isPending ? "Saving…" : list ? "Save" : "Start the list"}
          </Text>
        </Button>
      </ScrollView>
    </Sheet>
  );
}
