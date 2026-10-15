import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Avatar, Button, Skeleton, Text } from "./ui";

import { useApi } from "../lib/api/client";
import { useFavoriteReviews } from "../lib/api/hooks";
import { queryKeys } from "../lib/api/queryKeys";
import type { FavoriteReviewsResponse, Review, SetFavoritesInput } from "../lib/api/types";
import { formatRating } from "../lib/format";
import { reviewSubject, soloSet } from "../lib/review";
import { ROUTES } from "../lib/routes";

const MAX_FAVORITES = 3;

/** A user's pinned top-3 shows, shown on their profile beside the stats
 * counts (see StatsSummary's `favorites` slot). Read-only for
 * everyone but the profile's owner, who can tap "Edit" to pick from their
 * own reviews - tap order sets the rank (#1 first). */
export function FavoritesShowcase({
  username,
  isSelf,
  ownReviews,
}: {
  username: string;
  isSelf: boolean;
  /** The signed-in owner's own reviews, to pick favorites from.
   * Unused (and not required) when isSelf is false. */
  ownReviews?: Review[];
}) {
  const { data } = useFavoriteReviews(username);
  const [editing, setEditing] = useState(false);

  if (!data) {
    return (
      <View>
        <Skeleton className="h-4 w-28" />
        <View className="mt-2 flex-row gap-2">
          {Array.from({ length: MAX_FAVORITES }).map((_, i) => (
            <View key={i} className="w-[72px] items-center">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="mt-1.5 h-3 w-14" />
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (!data.items.length && !isSelf) return null;

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-paper">Favorite shows</Text>
        {isSelf && (
          <Pressable onPress={() => setEditing(true)} hitSlop={6}>
            <Text className="text-xs text-primary-dark">Edit</Text>
          </Pressable>
        )}
      </View>
      <View className="mt-2 flex-row gap-2">
        {Array.from({ length: MAX_FAVORITES }).map((_, i) => {
          const review = data.items[i];
          if (!review) {
            return isSelf ? (
              <Pressable
                key={i}
                onPress={() => setEditing(true)}
                className="h-[72px] w-[72px] items-center justify-center rounded-xl border border-dashed border-primary/30"
              >
                <Text className="text-2xl text-primary/40">+</Text>
              </Pressable>
            ) : null;
          }
          return (
            <Pressable
              key={review.id}
              onPress={() => router.push(ROUTES.REVIEW_DETAIL(review.id))}
              className="w-[72px] items-center"
            >
              <Avatar uri={reviewSubject(review, soloSet(review)).imageUrl} name={reviewSubject(review, soloSet(review)).name} size={48} />
              <Text className="mt-1 text-center text-xs text-paper" numberOfLines={2}>
                {reviewSubject(review, soloSet(review)).name}
              </Text>
              <Text className="text-xs text-muted">{formatRating((soloSet(review) ?? review).rating)}</Text>
            </Pressable>
          );
        })}
      </View>
      {isSelf && (
        <EditFavoritesModal
          visible={editing}
          onClose={() => setEditing(false)}
          username={username}
          current={data}
          ownReviews={ownReviews ?? []}
        />
      )}
    </View>
  );
}

function EditFavoritesModal({
  visible,
  onClose,
  username,
  current,
  ownReviews,
}: {
  visible: boolean;
  onClose: () => void;
  username: string;
  current: FavoriteReviewsResponse;
  ownReviews: Review[];
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>(() => current.items.map((r) => r.id));
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_FAVORITES) return prev;
      return [...prev, id];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const input: SetFavoritesInput = { reviewIds: selected };
      const result = await api.patch<FavoriteReviewsResponse>("/users/me/favorites", input);
      queryClient.setQueryData(queryKeys.users.favorites(username), result);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-ink/40">
        <Pressable onPress={(e) => e.stopPropagation()} className="max-h-[70%] rounded-t-2xl bg-surface-dark p-5">
          <Text className="text-center text-lg font-display text-paper">Pin your top {MAX_FAVORITES} shows</Text>
          <Text className="mt-1 text-center text-xs text-muted">
            Tap to pin, in the order you want them shown. Tap again to unpin.
          </Text>
          <ScrollView className="mt-4 max-h-96" contentContainerClassName="gap-2">
            {!ownReviews.length ? (
              <Text className="py-6 text-center text-muted">
                Review a show first, then come back to pin your favorites.
              </Text>
            ) : (
              ownReviews.map((review) => {
                const rank = selected.indexOf(review.id);
                const isSelected = rank !== -1;
                return (
                  <Pressable
                    key={review.id}
                    onPress={() => toggle(review.id)}
                    className={`flex-row items-center gap-3 rounded-xl border px-3 py-2 ${
                      isSelected ? "border-primary bg-primary-dark/15" : "border-primary/15"
                    }`}
                  >
                    <Avatar uri={reviewSubject(review, soloSet(review)).imageUrl} name={reviewSubject(review, soloSet(review)).name} size={32} />
                    <View className="flex-1">
                      <Text className="text-paper">{reviewSubject(review, soloSet(review)).name}</Text>
                      <Text className="text-xs text-muted">{formatRating((soloSet(review) ?? review).rating)}</Text>
                    </View>
                    {isSelected && (
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-primary-dark">
                        <Text className="text-xs font-semibold text-paper">{rank + 1}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          <View className="mt-4 flex-row gap-3">
            <Button onPress={save} disabled={saving} className="flex-1 py-3">
              <Text className="text-center font-semibold text-paper">{saving ? "Saving…" : "Save"}</Text>
            </Button>
            <Pressable
              onPress={onClose}
              className="flex-1 items-center justify-center rounded-xl border border-primary/30 py-3"
            >
              <Text className="text-center font-semibold text-paper">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
