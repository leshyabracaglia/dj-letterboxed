import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, TextInput, View } from "react-native";

import {
  artistPickKey,
  artistPickName,
  draftFromRA,
  draftFromReview,
  draftProblem,
  emptyDraft,
  type IArtistPick,
  type IBlankSeed,
  type IEventPick,
  type ILineupEntry,
  type IReviewDraft,
  type ISheet,
} from "../../components/log/draft";
import { FieldLabel, LinedInput, SectionHeading } from "../../components/log/fields";
import { FindTheNight } from "../../components/log/FindTheNight";
import { ArtistSearchInput, CaughtChecklist, CreateArtistSheet, LineupCard } from "../../components/log/lineup";
import { NightPoster, PosterCaption } from "../../components/log/NightPoster";
import { DateSheet, EventSheet, VenueSheet } from "../../components/log/sheets";
import { TagPicker } from "../../components/log/TagPicker";
import { useLogNight } from "../../components/log/useLogNight";
import { TagFriendsPicker } from "../../components/TagFriendsPicker";
import {
  Button,
  Card,
  Icon,
  KeyboardScrollView,
  Page,
  RatingStampPicker,
  Tape,
  Text,
  TORN_CARD_GAP,
  usePageContentStyle,
} from "../../components/ui";
import { errorMessage, useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { RAEvent, RAEventMatch, Review, VenueDetail } from "../../lib/api/types";
import { useCurrentUser } from "../../lib/auth";
import { plural } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

// The log tab: find the night, then fill in its poster and rate it. The
// form's pieces live in components/log/.
export default function CreateReviewScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();
  const scrollRef = useRef<ScrollView>(null);
  const djInputRef = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;

  const { me } = useCurrentUser();
  const { logNight, pending } = useLogNight();

  // The log opens on the search; picking a night (or a blank poster) moves
  // on to the poster form.
  const [stage, setStage] = useState<"search" | "form">("search");
  // The RA night being matched to DJs and a venue, while it loads.
  const [matchingId, setMatchingId] = useState<string>();
  const [filledFrom, setFilledFrom] = useState<string>();
  // The review a poster was filled in from (ROUTES.REVIEW_FROM), while it
  // loads and then until it's logged.
  const { fromReview } = useLocalSearchParams<{ fromReview?: string }>();
  const [sourceReviewId, setSourceReviewId] = useState<string>();
  const [prefilling, setPrefilling] = useState(false);
  const [venueSheetQuery, setVenueSheetQuery] = useState("");
  const [sheet, setSheet] = useState<ISheet>();
  const [addingDj, setAddingDj] = useState(false);
  const [djQuery, setDjQuery] = useState("");
  const [lineup, setLineup] = useState<ILineupEntry[]>([]);
  // Open for a new artist (null) or to edit a hand-made one in the lineup (its key).
  const [artistSheet, setArtistSheet] = useState<{ editingKey: string | null }>();
  const [draft, setDraft] = useState<IReviewDraft>(emptyDraft);
  const [venueMissing, setVenueMissing] = useState(false);
  const [nightMissing, setNightMissing] = useState(false);
  const [error, setError] = useState<string>();

  const updateDraft = (changes: Partial<IReviewDraft>) => setDraft((prev) => ({ ...prev, ...changes }));
  const updateEntry = (key: string, changes: Partial<ILineupEntry>) =>
    setLineup((prev) => prev.map((e) => (e.key === key ? { ...e, ...changes } : e)));

  // Move on to the poster form, starting from `next`.
  const openForm = (next: { draft: IReviewDraft; lineup?: ILineupEntry[]; filledFrom?: string; error?: string }) => {
    setDraft(next.draft);
    setLineup(next.lineup ?? []);
    setFilledFrom(next.filledFrom);
    setError(next.error);
    setStage("form");
  };

  const resetForm = () => {
    setStage("search");
    setFilledFrom(undefined);
    setSourceReviewId(undefined);
    setMatchingId(undefined);
    setSheet(undefined);
    setDjQuery("");
    setAddingDj(false);
    setLineup([]);
    setDraft(emptyDraft());
    setVenueMissing(false);
    setNightMissing(false);
    setError(undefined);
  };

  const addToLineup = (pick: IArtistPick) => {
    const key = artistPickKey(pick);
    // Adding a DJ who's on the RA lineup ticks them off.
    setLineup((prev) =>
      prev.some((e) => e.key === key)
        ? prev.map((e) => (e.key === key ? { ...e, caught: true } : e))
        : [...prev, { key, pick, reviewText: "", reviewing: false, caught: true }],
    );
    setDjQuery("");
    setAddingDj(false);
  };

  // "+ Who played" on the poster: open the DJ search below and focus it
  // (which scrolls it into view).
  const startAddingDj = () => {
    setAddingDj(true);
    requestAnimationFrame(() => djInputRef.current?.focus());
  };

  // A missing venue shakes the poster's venue strip and outlines it, rather
  // than an error under the form.
  const flagMissingVenue = () => {
    setVenueMissing(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const useNativeDriver = Platform.OS !== "web";
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, -4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 50, useNativeDriver })),
    ).start();
  };

  const caught = lineup.filter((e) => e.caught);
  const listedLineup = lineup.filter((e) => e.listed);

  // Fill the poster from an RA night: its DJs matched to Beatboxd/Spotify
  // and its venue to Google Places by the server.
  const pickRAEvent = async (event: RAEvent) => {
    setMatchingId(event.id);
    try {
      const match = await queryClient.fetchQuery({
        queryKey: queryKeys.ra.match(event.id),
        queryFn: () => api.get<RAEventMatch>(`/ra/events/${event.id}/match`),
        staleTime: 5 * 60 * 1000,
      });
      openForm({ ...draftFromRA(match), filledFrom: "Resident Advisor" });
    } catch (err) {
      // Still get them logging: a poster seeded with what RA listed.
      openForm({
        draft: {
          ...emptyDraft(),
          venuePick: event.venue.name ? { type: "typed", name: event.venue.name, city: event.venue.area } : undefined,
        },
        error: `Couldn't fill this in from Resident Advisor (${errorMessage(err, "try again")}). Fill in the rest below.`,
      });
    } finally {
      setMatchingId(undefined);
    }
  };

  // Fill the poster from a night someone tagged you in. The param is
  // cleared once read, so coming back to the tab doesn't refill it.
  useEffect(() => {
    if (!fromReview || !me) return;
    router.setParams({ fromReview: undefined });
    setPrefilling(true);
    (async () => {
      try {
        const review = await queryClient.fetchQuery({
          queryKey: queryKeys.reviews.byId(fromReview),
          queryFn: () => api.get<Review>(`/reviews/${fromReview}`),
        });
        const venueId = review.venueId;
        const venue = venueId
          ? await queryClient.fetchQuery({
              queryKey: queryKeys.venues.byId(venueId),
              queryFn: () => api.get<VenueDetail>(`/venues/${venueId}`),
            })
          : undefined;
        openForm({
          ...draftFromReview(review, venue?.venue, me.id),
          filledFrom: review.user ? `@${review.user.username}'s log` : "their log",
        });
        setSourceReviewId(review.id);
      } catch (err) {
        setError(`Couldn't fill in that night (${errorMessage(err, "try again")}).`);
      } finally {
        setPrefilling(false);
      }
    })();
  }, [fromReview, me, api, queryClient]);

  const startBlank = (seed?: IBlankSeed, eventPick?: IEventPick) => {
    openForm({
      draft: {
        ...emptyDraft(),
        eventPick: eventPick ?? (seed?.type === "event" ? { type: "new", name: seed.text } : undefined),
      },
    });
    if (seed?.type === "dj") {
      setDjQuery(seed.text);
      startAddingDj();
    } else if (seed?.type === "venue") {
      setVenueSheetQuery(seed.text);
      setSheet("venue");
    }
  };

  const onSubmit = async () => {
    const problem = draftProblem(draft, caught);
    setError(problem?.message);
    if (problem?.field === "venue") flagMissingVenue();
    if (problem?.field === "night") setNightMissing(true);
    if (problem) return;

    try {
      const reviewId = await logNight(draft, caught, {
        sourceReviewId,
        onDjSaved: (key, dj) => updateEntry(key, { pick: { type: "existing", dj } }),
      });
      // The tab stays mounted behind the review page, so clear it for the
      // next log rather than leaving this one's answers filled in on back.
      resetForm();
      router.push(ROUTES.REVIEW_DETAIL(reviewId, { justLogged: true }));
    } catch (err) {
      setError(errorMessage(err, "Could not save your review"));
    }
  };

  const editingEntry = lineup.find((e) => e.key === artistSheet?.editingKey);
  const closeSheet = () => setSheet(undefined);

  if (prefilling) {
    return (
      <Page title="Log a night" channel="CH 03 · Log">
        <View className="flex-1 items-center justify-center">
          <Text className="font-display text-xl uppercase text-paper/70">Filling in the night…</Text>
        </View>
      </Page>
    );
  }

  if (stage === "search") {
    return (
      <Page title="Log a night" channel="CH 03 · Log">
        {!!error && <Text className="mx-6 text-stamp-red">{error}</Text>}
        <FindTheNight
          matchingId={matchingId}
          onPickRA={pickRAEvent}
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
          onPress={resetForm}
          hitSlop={8}
          accessibilityLabel="Back to search"
          className="mt-1 flex-row items-center gap-1 self-start active:opacity-70"
        >
          <Icon name="chevron-back" size={16} className="text-paper/70" />
          <Text className="font-display text-base uppercase text-paper/70">Search again</Text>
        </Pressable>
        <View className="mt-2">
          <NightPoster
            draft={draft}
            lineup={lineup.map((e) => ({ name: artistPickName(e.pick), dim: !e.caught }))}
            username={me?.username}
            venueMissing={venueMissing}
            shake={shake}
            onEdit={setSheet}
            onAddDj={startAddingDj}
            onToggle={(field) => updateDraft({ [field]: !draft[field] })}
          />
          <View className="-mt-2" />
          <PosterCaption draft={draft} username={me?.username} filledFrom={filledFrom} />
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
            title={
              caught.length ? `Rate the ${caught.length === 1 ? "set" : plural(caught.length, "set")}` : "Rate the sets"
            }
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
                    ? () => setArtistSheet({ editingKey: entry.key })
                    : undefined
                }
                // A listed DJ is unticked (still listed above); one you added goes.
                onRemove={() =>
                  entry.listed
                    ? updateEntry(entry.key, { caught: false })
                    : setLineup((prev) => prev.filter((e) => e.key !== entry.key))
                }
              />
            ))}
            {addingDj ? (
              <ArtistSearchInput
                inputRef={djInputRef}
                value={djQuery}
                onChangeText={setDjQuery}
                onSelect={addToLineup}
                onCreate={() => setArtistSheet({ editingKey: null })}
                onCancel={() => {
                  setAddingDj(false);
                  setDjQuery("");
                }}
              />
            ) : (
              <Pressable
                onPress={startAddingDj}
                className="flex-row items-center gap-2 border border-dashed border-paper/50 bg-black/30 px-4 py-3 active:opacity-70"
              >
                <Icon name="add" size={18} className="text-paper/80" />
                <Text className="font-display text-xl uppercase text-paper/80">Add a DJ: search Spotify</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View className="mt-8 gap-4">
          <SectionHeading
            number={listedLineup.length ? "03" : "02"}
            title="The night overall"
            numberClassName="text-stamp-red"
            aside="Required"
            asideClassName={nightMissing ? "text-danger-dark" : "text-paper/50"}
          />
          <Card tint="neutral" className="gap-5 pb-5">
            <Tape style={{ top: -10, right: 32 }} rotate={5} />
            <View className="gap-2">
              <FieldLabel>Your rating</FieldLabel>
              <RatingStampPicker
                value={draft.rating}
                onChange={(rating) => {
                  updateDraft({ rating });
                  setNightMissing(false);
                }}
                size={48}
              />
              {nightMissing && <Text className="text-sm text-danger-dark">Rate the night to pin it up</Text>}
            </View>
            <View className="gap-2">
              <FieldLabel>What was it like</FieldLabel>
              <TagPicker
                tags={draft.tags}
                onAdd={(tag) => setDraft((prev) => ({ ...prev, tags: [...prev.tags, tag] }))}
                onRemove={(tag) => setDraft((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))}
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
                onAdd={(user) => setDraft((prev) => ({ ...prev, taggedUsers: [...prev.taggedUsers, user] }))}
                onRemoveTaggedUser={(userId) =>
                  setDraft((prev) => ({ ...prev, taggedUsers: prev.taggedUsers.filter((u) => u.id !== userId) }))
                }
              />
            </View>
          </Card>
        </View>

        <View className="mt-6 gap-3">
          {!!error && <Text className="text-danger-dark">{error}</Text>}
          <Button disabled={pending} onPress={onSubmit} className="flex-row gap-2 py-3">
            <Text className="font-display text-2xl uppercase text-paper">
              {pending ? "Pinning it up…" : "Pin it to the wall"}
            </Text>
            {!pending && <Icon name="arrow-forward" size={20} className="text-paper" />}
          </Button>
        </View>
      </KeyboardScrollView>

      {sheet === "event" && (
        <EventSheet
          current={draft.eventPick}
          onPick={(eventPick) => {
            updateDraft({ eventPick });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      )}
      {sheet === "date" && (
        <DateSheet
          value={draft.seenAt}
          onPick={(seenAt) => {
            updateDraft({ seenAt });
            closeSheet();
          }}
          onClose={closeSheet}
        />
      )}
      {sheet === "venue" && (
        <VenueSheet
          current={draft.venuePick}
          initialQuery={venueSheetQuery}
          onPick={(venuePick) => {
            updateDraft({ venuePick });
            setVenueMissing(false);
            setVenueSheetQuery("");
            closeSheet();
          }}
          onClose={() => {
            setVenueSheetQuery("");
            closeSheet();
          }}
        />
      )}
      {artistSheet && (
        <CreateArtistSheet
          initial={editingEntry?.pick.type === "new" ? editingEntry.pick.input : { name: djQuery.trim() }}
          onClose={() => setArtistSheet(undefined)}
          onSave={(input) => {
            if (editingEntry) {
              updateEntry(editingEntry.key, { pick: { type: "new", input } });
            } else {
              addToLineup({ type: "new", input });
            }
            setArtistSheet(undefined);
          }}
        />
      )}
    </Page>
  );
}
