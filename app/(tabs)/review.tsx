import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, TextInput, View } from "react-native";

import {
  artistPickName,
  draftFromRA,
  draftFromReview,
  draftProblem,
  emptyDraft,
  type BlankSeed,
  type EventPick,
  type DraftLineupEntry,
  type ReviewDraft,
} from "@/components/log/draft";
import { FieldLabel, LinedInput, SectionHeading } from "@/components/log/fields";
import { FindTheNight } from "@/components/log/FindTheNight";
import { ArtistSearchInput, CaughtChecklist, CreateArtistSheet, LineupCard } from "@/components/log/lineup";
import { NightPoster, PosterCaption } from "@/components/log/NightPoster";
import { DateSheet, EventSheet, VenueSheet } from "@/components/log/sheets";
import { TagPicker } from "@/components/log/TagPicker";
import { useLogForm } from "@/components/log/useLogForm";
import { useLogNight } from "@/components/log/useLogNight";
import { TagFriendsPicker } from "@/components/TagFriendsPicker";
import {
  Button,
  Card,
  Icon,
  KeyboardScrollView,
  Page,
  Tape,
  Text,
  TORN_CARD_GAP,
  usePageContentStyle,
} from "@/components/ui";
import { errorMessage, useApi, unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queryKeys";
import type { RAEvent } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { isWeb } from "@/lib/platform";

// The log tab: find the night, then fill in its poster and rate it. The
// form's pieces (and its state, useLogForm) live in components/log/.
export default function CreateReviewScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();
  const scrollRef = useRef<ScrollView>(null);
  const djInputRef = useRef<TextInput>(null);
  const [shake] = useState(() => new Animated.Value(0));

  const { me } = useCurrentUser();
  const { logNight, pending } = useLogNight();
  const { state, dispatch, caught, listedLineup, editingEntry } = useLogForm();
  const { draft, lineup } = state;
  const { fromReview } = useLocalSearchParams<{ fromReview?: string }>();

  const updateDraft = (changes: Partial<ReviewDraft>) => dispatch({ type: "updateDraft", changes });
  const updateEntry = (key: string, changes: Partial<DraftLineupEntry>) =>
    dispatch({ type: "updateEntry", key, changes });
  const closeSheet = () => dispatch({ type: "closeSheet" });

  // "+ Who played" on the poster: open the DJ search below and focus it
  // (which scrolls it into view).
  const startAddingDj = (query?: string) => {
    dispatch({ type: "startAddingDj", query });
    requestAnimationFrame(() => djInputRef.current?.focus());
  };

  // A missing venue shakes the poster's venue strip and outlines it, rather
  // than an error under the form.
  const shakeVenue = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const useNativeDriver = !isWeb;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, -4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 50, useNativeDriver })),
    ).start();
  };

  // Fill the poster from an RA night: its DJs matched to Beatboxd/Spotify
  // and its venue to Google Places by the server.
  const matchRAEvent = useMutation({
    mutationFn: (event: RAEvent) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.ra.match(event.id),
        queryFn: () => unwrap(api.GET("/api/ra/events/{id}/match", { params: { path: { id: event.id } } })),
        staleTime: 5 * 60 * 1000,
      }),
    onSuccess: (match) => dispatch({ type: "openForm", ...draftFromRA(match), filledFrom: "Resident Advisor" }),
    // Still get them logging: a poster seeded with what RA listed.
    onError: (err, event) =>
      dispatch({
        type: "openForm",
        draft: {
          ...emptyDraft(),
          venuePick: event.venue.name ? { type: "typed", name: event.venue.name, city: event.venue.area } : undefined,
        },
        error: `Couldn't fill this in from Resident Advisor (${errorMessage(err, "try again")}). Fill in the rest below.`,
      }),
  });
  const matchingId = matchRAEvent.isPending ? matchRAEvent.variables.id : undefined;

  // Fill the poster from a night someone tagged you in.
  const prefill = useMutation({
    mutationFn: async ({ reviewId, userId }: { reviewId: string; userId: string }) => {
      const review = await queryClient.fetchQuery({
        queryKey: queryKeys.reviews.byId(reviewId),
        queryFn: () => unwrap(api.GET("/api/reviews/{id}", { params: { path: { id: reviewId } } })),
      });
      const venueId = review.venueId;
      const venue = venueId
        ? await queryClient.fetchQuery({
            queryKey: queryKeys.venues.byId(venueId),
            queryFn: () => unwrap(api.GET("/api/venues/{id}", { params: { path: { id: venueId } } })),
          })
        : undefined;
      return { review, ...draftFromReview(review, venue?.venue, userId) };
    },
    onSuccess: ({ review, ...filled }) =>
      dispatch({
        type: "openForm",
        ...filled,
        filledFrom: review.user ? `@${review.user.username}'s log` : "their log",
        sourceReviewId: review.id,
      }),
    onError: (err) =>
      dispatch({ type: "setError", error: `Couldn't fill in that night (${errorMessage(err, "try again")}).` }),
  });
  // The param is cleared once read, so coming back to the tab doesn't
  // refill it.
  const { mutate: prefillFrom } = prefill;
  useEffect(() => {
    if (!fromReview || !me) return;
    router.setParams({ fromReview: undefined });
    prefillFrom({ reviewId: fromReview, userId: me.id });
  }, [fromReview, me, prefillFrom]);

  const startBlank = (seed?: BlankSeed, eventPick?: EventPick) => {
    dispatch({
      type: "openForm",
      draft: {
        ...emptyDraft(),
        eventPick: eventPick ?? (seed?.type === "event" ? { type: "new", name: seed.text } : undefined),
      },
    });
    if (seed?.type === "dj") startAddingDj(seed.text);
    else if (seed?.type === "venue") dispatch({ type: "openSheet", sheet: "venue", venueQuery: seed.text });
  };

  const onSubmit = async () => {
    const problem = draftProblem(draft);
    dispatch({ type: "setError", error: problem?.message });
    if (problem?.field) dispatch({ type: "flagMissing", field: problem.field });
    if (problem?.field === "venue") shakeVenue();
    if (problem) return;

    try {
      const reviewId = await logNight(draft, caught, {
        sourceReviewId: state.sourceReviewId,
        onDjSaved: (key, dj) => updateEntry(key, { pick: { type: "existing", dj } }),
      });
      // The tab stays mounted behind the review page, so clear it for the
      // next log rather than leaving this one's answers filled in on back.
      dispatch({ type: "reset" });
      router.push(ROUTES.REVIEW_DETAIL(reviewId, { justLogged: true }));
    } catch (err) {
      dispatch({ type: "setError", error: errorMessage(err, "Could not save your review") });
    }
  };

  if (prefill.isPending) {
    return (
      <Page title="Log a night" channel="CH 03 · Log">
        <View className="flex-1 items-center justify-center">
          <Text variant="display" className="text-xl text-paper/70">
            Filling in the night…
          </Text>
        </View>
      </Page>
    );
  }

  if (state.stage === "search") {
    return (
      <Page title="Log a night" channel="CH 03 · Log">
        {!!state.error && <Text className="mx-6 text-stamp-red">{state.error}</Text>}
        <FindTheNight
          matchingId={matchingId}
          onPickRA={(event) => matchRAEvent.mutate(event)}
          onPickEvent={(event) => startBlank(undefined, { type: "existing", event })}
          onStartBlank={startBlank}
        />
      </Page>
    );
  }

  return (
    <Page title="Log a night" channel="CH 03 · Log">
      <KeyboardScrollView ref={scrollRef} contentContainerStyle={contentStyle}>
        <Pressable
          onPress={() => dispatch({ type: "reset" })}
          hitSlop={8}
          accessibilityLabel="Back to search"
          className="mt-1 flex-row items-center gap-1 self-start active:opacity-70"
        >
          <Icon name="chevron-back" size={16} className="text-paper/70" />
          <Text variant="display" className="text-base text-paper/70">
            Search again
          </Text>
        </Pressable>
        <View className="mt-2">
          <NightPoster
            draft={draft}
            lineup={lineup.map((e) => ({ name: artistPickName(e.pick), dim: !e.caught }))}
            username={me?.username}
            venueMissing={state.venueMissing}
            shake={shake}
            onEdit={(sheet) => dispatch({ type: "openSheet", sheet })}
            onAddDj={() => startAddingDj()}
            onToggle={(field) => updateDraft({ [field]: !draft[field] })}
          />
          <View className="-mt-2" />
          <PosterCaption draft={draft} username={me?.username} filledFrom={state.filledFrom} />
        </View>

        {!!listedLineup.length && (
          <View className="mt-8 gap-4">
            <SectionHeading
              number="01"
              title="Who did you catch?"
              numberClassName="text-stamp-red"
              aside={`${listedLineup.filter((e) => e.caught).length} of ${listedLineup.length}`}
            />
            <CaughtChecklist
              lineup={listedLineup}
              onToggle={(key) => {
                const entry = lineup.find((e) => e.key === key);
                if (entry) updateEntry(key, { caught: !entry.caught });
              }}
            />
          </View>
        )}

        <View className="mt-8 gap-4">
          <SectionHeading
            number={listedLineup.length ? "02" : "01"}
            title={caught.length === 1 ? "The set" : "The sets"}
            numberClassName="text-primary-dark"
          />
          <View className={TORN_CARD_GAP}>
            {caught.map((entry, index) => (
              <LineupCard
                key={entry.key}
                entry={entry}
                index={index}
                onChange={(changes) => updateEntry(entry.key, changes)}
                // Only hand-made artists (not yet saved, not from Spotify) are editable.
                onEdit={
                  entry.pick.type === "new" && !entry.pick.input.spotifyId
                    ? () => dispatch({ type: "openArtistSheet", editingKey: entry.key })
                    : undefined
                }
                onRemove={() => dispatch({ type: "removeEntry", key: entry.key })}
              />
            ))}
            {state.addingDj ? (
              <ArtistSearchInput
                inputRef={djInputRef}
                value={state.djQuery}
                onChangeText={(query) => dispatch({ type: "setDjQuery", query })}
                onSelect={(pick) => dispatch({ type: "addToLineup", pick })}
                onCreate={() => dispatch({ type: "openArtistSheet", editingKey: null })}
                onCancel={() => dispatch({ type: "cancelAddingDj" })}
              />
            ) : (
              <Pressable
                onPress={() => startAddingDj()}
                className="flex-row items-center gap-2 border border-dashed border-paper/50 bg-black/30 px-4 py-3 active:opacity-70"
              >
                <Icon name="add" size={18} className="text-paper/80" />
                <Text variant="display" className="text-xl text-paper/80">
                  Add a DJ: search Spotify
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View className="mt-8 gap-4">
          <SectionHeading
            number={listedLineup.length ? "03" : "02"}
            title="The night overall"
            numberClassName="text-stamp-red"
          />
          <Card tint="neutral" className="gap-5 pb-5">
            <Tape style={{ top: -10, right: 32 }} rotate={5} />
            <View className="gap-2">
              <FieldLabel>What was it like</FieldLabel>
              <TagPicker
                tags={draft.tags}
                onAdd={(tag) => updateDraft({ tags: [...draft.tags, tag] })}
                onRemove={(tag) => updateDraft({ tags: draft.tags.filter((t) => t !== tag) })}
              />
            </View>
            <View className="gap-1">
              <FieldLabel>Review</FieldLabel>
              <LinedInput
                value={draft.reviewText}
                onChangeText={(reviewText) => updateDraft({ reviewText })}
                placeholder="How was the night?"
                lines={5}
              />
            </View>
            <View className="gap-2">
              <FieldLabel>Who you went with</FieldLabel>
              <TagFriendsPicker
                taggedUsers={draft.taggedUsers}
                onAdd={(user) => updateDraft({ taggedUsers: [...draft.taggedUsers, user] })}
                onRemoveTaggedUser={(userId) =>
                  updateDraft({ taggedUsers: draft.taggedUsers.filter((u) => u.id !== userId) })
                }
              />
            </View>
          </Card>
        </View>

        <View className="mt-6 gap-3">
          {!!state.error && <Text className="text-danger-dark">{state.error}</Text>}
          <Button disabled={pending} onPress={onSubmit} className="flex-row gap-2 py-3">
            <Text variant="display" className="text-2xl text-paper">
              {pending ? "Pinning it up…" : "Pin it to the wall"}
            </Text>
            {!pending && <Icon name="arrow-forward" size={20} className="text-paper" />}
          </Button>
        </View>
      </KeyboardScrollView>

      {state.sheet === "event" && (
        <EventSheet
          current={draft.eventPick}
          onPick={(eventPick) => {
            updateDraft({ eventPick });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      )}
      {state.sheet === "date" && (
        <DateSheet
          value={draft.seenAt}
          onPick={(seenAt) => {
            updateDraft({ seenAt });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      )}
      {state.sheet === "venue" && (
        <VenueSheet
          current={draft.venuePick}
          initialQuery={state.venueSheetQuery}
          onPick={(venuePick) => {
            updateDraft({ venuePick });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      )}
      {state.artistSheet && (
        <CreateArtistSheet
          initial={editingEntry?.pick.type === "new" ? editingEntry.pick.input : { name: state.djQuery.trim() }}
          onClose={() => dispatch({ type: "closeArtistSheet" })}
          onSave={(input) => dispatch({ type: "saveArtist", input })}
        />
      )}
    </Page>
  );
}
