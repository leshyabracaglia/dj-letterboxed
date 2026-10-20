import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Button, Icon, Sheet, Text } from "@/components/ui";
import { TagFriendsPicker } from "@/components/TagFriendsPicker";
import { invalidateReviewLists, patchCachedReview } from "@/lib/api/cache";
import { errorMessage, useApi, unwrap } from "@/lib/api/client";
import type { ReviewDetail, UpdateReviewInput, User } from "@/lib/api/types";
import { colors } from "@/lib/colors";
import { confirmDestructive, showAlert } from "@/lib/dialog";
import { ROUTES } from "@/lib/routes";

// What only a review's author can do to it: it's fixed once logged, except
// for who they tagged as being there, and it can be deleted.

// A review is fixed once it's logged, except for who you tagged as being there
// with you: this opens a sheet to change that.
export function WhoWasThereButton({ review }: { review: ReviewDetail }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tagged, setTagged] = useState<User[]>(review.taggedUsers);
  const save = useMutation({
    mutationFn: (input: UpdateReviewInput) =>
      unwrap(api.PATCH("/api/reviews/{id}", { params: { path: { id: review.id } }, body: input })),
    onSuccess: ({ taggedUsers }) => {
      patchCachedReview(queryClient, review.id, (r) => ({ ...r, taggedUsers }));
      setOpen(false);
    },
  });

  const openSheet = () => {
    setTagged(review.taggedUsers);
    save.reset();
    setOpen(true);
  };
  const hasTagged = !!review.taggedUsers.length;

  return (
    <>
      <Pressable
        onPress={openSheet}
        className="flex-row items-center justify-center gap-2 self-center border border-dashed border-paper/60 px-4 py-2 active:opacity-70"
      >
        <Icon name="people-outline" size={16} className="text-paper" />
        <Text variant="display" className="text-lg leading-5 text-paper">
          {hasTagged ? "Edit who was there" : "Tag who was there"}
        </Text>
      </Pressable>
      {open && (
        <Sheet title="Who was there?" tag="With you" onClose={() => setOpen(false)}>
          <View className="gap-4 px-4">
            <Text className="text-xs text-paper/60">
              Your log is pinned to the wall. Who you went with is the one thing you can still change.
            </Text>
            <TagFriendsPicker
              taggedUsers={tagged}
              startTyping={!tagged.length}
              onAdd={(user) => setTagged((prev) => [...prev, user])}
              onRemoveTaggedUser={(userId) => setTagged((prev) => prev.filter((u) => u.id !== userId))}
            />
            {save.isError && (
              <Text className="text-danger-dark">{errorMessage(save.error, "Could not save. Try again.")}</Text>
            )}
            <Button
              disabled={save.isPending}
              onPress={() => save.mutate({ taggedUserIds: tagged.map((u) => u.id) })}
              className="py-3"
            >
              <Text variant="display" className="text-xl text-paper">
                {save.isPending ? "Saving…" : "Save"}
              </Text>
            </Button>
          </View>
        </Sheet>
      )}
    </>
  );
}

// Deletes the whole night out, with every DJ review in it.
export function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/reviews/{id}", { params: { path: { id: reviewId } } })),
    onSuccess: () => {
      invalidateReviewLists(queryClient);
      if (router.canGoBack()) router.back();
      else router.replace(ROUTES.FEED);
    },
    onError: (err) => showAlert("Could not delete review", errorMessage(err, "Please try again.")),
  });

  const onPress = async () => {
    const confirmed = await confirmDestructive({
      title: "Delete review",
      message: "This deletes your review of the night and every DJ in it. This can't be undone.",
    });
    if (confirmed) remove.mutate();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={remove.isPending}
      className="flex-row items-center gap-1.5 self-center px-3 py-2 active:opacity-70"
    >
      {remove.isPending ? (
        <ActivityIndicator size="small" color={colors.paper} />
      ) : (
        <Icon name="trash-outline" size={16} className="text-paper/60" />
      )}
      <Text variant="display" className="text-lg text-paper/60">
        Delete review
      </Text>
    </Pressable>
  );
}
