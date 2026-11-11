import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { FindTrack } from "@/components/log/TrackSheet";
import { ModerationButton } from "@/components/ModerationSheet";
import { ClipPlayer, ClipRecorder, type LocalClip } from "@/components/TrackClip";
import { TrackRow } from "@/components/TrackRow";
import { DashedButton, Sheet, Text } from "@/components/ui";
import { apiUrl, errorMessage, unwrap, useApi } from "@/lib/api/client";
import { patchCachedReview } from "@/lib/api/cache";
import { useUploadTrackClip } from "@/lib/api/hooks";
import type { Review, ReviewDetail, ReviewTrack } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { showAlert } from "@/lib/dialog";

/** An unidentified track's ID request, under it on its night's page: its
 * clip if it has one (to play, or report; its poster can record or remove
 * it), what people think it is, and a way to say. The night's poster
 * accepts the right one (or names it themselves); whoever suggested one can
 * take it back. */
export function TrackIdRequest({ review, track }: { review: ReviewDetail; track: ReviewTrack }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { me } = useCurrentUser();
  const [naming, setNaming] = useState(false);
  const isOwner = me?.id === review.userId;

  // Each change answers with the whole night; every cached copy of it takes
  // the new tracks.
  const applied = (updated: Review) =>
    patchCachedReview(queryClient, review.id, (old) => ({ ...old, tracks: updated.tracks }));
  const onError = (err: unknown) => showAlert("Couldn't do that", errorMessage(err, "Try again in a moment."));

  const suggest = useMutation({
    mutationFn: (body: {
      source: string;
      externalId?: string;
      url?: string;
      title: string;
      artist?: string;
      artworkUrl?: string;
    }) => unwrap(api.POST("/api/tracks/{id}/suggestions", { params: { path: { id: track.id } }, body })),
    onSuccess: (updated) => {
      setNaming(false);
      applied(updated);
    },
    onError,
  });
  const accept = useMutation({
    mutationFn: (id: string) => unwrap(api.POST("/api/track-suggestions/{id}/accept", { params: { path: { id } } })),
    onSuccess: applied,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/track-suggestions/{id}", { params: { path: { id } } })),
    onSuccess: applied,
    onError,
  });
  const uploadClip = useUploadTrackClip();
  const recordClip = useMutation({
    mutationFn: (clip: LocalClip) => uploadClip(track.id, clip.uri, clip.durationMs),
    onSuccess: applied,
    onError,
  });
  const removeClip = useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/tracks/{id}/clip", { params: { path: { id: track.id } } })),
    onSuccess: applied,
    onError,
  });

  if (track.title) return null;
  const suggestions = track.suggestions ?? [];
  const busy = suggest.isPending || accept.isPending || remove.isPending;

  return (
    <View className="mt-2 gap-2 border-l-2 border-paper/30 pl-3">
      {track.clipDurationMs ? (
        <View className="gap-1">
          <ClipPlayer uri={apiUrl(`/api/tracks/${track.id}/clip`)} durationMs={track.clipDurationMs} />
          {isOwner ? (
            <SuggestionAction
              label="Remove the clip"
              disabled={removeClip.isPending}
              onPress={() => removeClip.mutate()}
            />
          ) : (
            <View className="self-start">
              <ModerationButton user={review.user} target={{ trackId: track.id }} label="Report clip" />
            </View>
          )}
        </View>
      ) : (
        isOwner &&
        (recordClip.isPending ? (
          <Text className="text-sm text-paper/60">Uploading the clip…</Text>
        ) : (
          <ClipRecorder onRecorded={(clip) => recordClip.mutate(clip)} />
        ))
      )}
      {suggestions.map((s) => (
        <View key={s.id} className="gap-1.5">
          <Text variant="display" className="text-sm text-paper/70">
            @{s.user.username} thinks it&apos;s
          </Text>
          <TrackRow track={{ ...s, note: null }} showNote={false} />
          <View className="flex-row gap-4">
            {isOwner && <SuggestionAction label="That's it" disabled={busy} onPress={() => accept.mutate(s.id)} />}
            {(isOwner || s.user.id === me?.id) && (
              <SuggestionAction
                label={isOwner && s.user.id !== me?.id ? "Not it" : "Take it back"}
                disabled={busy}
                onPress={() => remove.mutate(s.id)}
              />
            )}
          </View>
        </View>
      ))}
      {!!me && (
        <DashedButton
          label={isOwner ? "Found it? Name the ID" : "Know it? Name the ID"}
          icon="musical-notes"
          onPress={() => setNaming(true)}
          className="border-paper/60 bg-black/15 py-2"
        />
      )}
      {naming && (
        <Sheet title="Name the ID" onClose={() => setNaming(false)}>
          <FindTrack
            allowUnknown={false}
            onPick={({ match, title }) => {
              if (match) {
                suggest.mutate({
                  source: match.source,
                  externalId: match.externalId,
                  url: match.url ?? undefined,
                  title: match.title,
                  artist: match.artist || undefined,
                  artworkUrl: match.artworkUrl ?? undefined,
                });
              } else if (title) {
                suggest.mutate({ source: "manual", title });
              }
            }}
          />
        </Sheet>
      )}
    </View>
  );
}

function SuggestionAction({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      className="active:opacity-70"
    >
      <Text variant="display" className={`text-base underline ${disabled ? "text-paper/40" : "text-paper"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
