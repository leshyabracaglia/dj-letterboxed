import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { CreateReviewInput, Dj, Paginated, Review } from "../../lib/api/types";
import { useCurrentUser } from "../../lib/auth";
import { parseDateInputValue } from "../../lib/format";
import type { ICreateDjInput, ILineupEntry, IReviewDraft } from "./draft";

// The POST /reviews body's where and when, from a draft draftProblem passed.
function logPlace(
  draft: IReviewDraft,
): Omit<CreateReviewInput, "rating" | "reviewText" | "lineup" | "tags" | "taggedUserIds"> {
  const { eventPick } = draft;
  const venuePick = draft.venuePick!;
  const seenAt = parseDateInputValue(draft.seenAt)!;
  // Midday local time, so the stored instant reads back as the same
  // calendar day in any time zone (UTC midnight shows as the day before
  // across the Americas).
  seenAt.setHours(12);
  return {
    ...(eventPick?.type === "existing"
      ? { eventId: eventPick.event.id }
      : eventPick?.type === "new"
        ? { eventName: eventPick.name }
        : {}),
    ...(venuePick.type === "existing"
      ? { venueId: venuePick.venue.id }
      : venuePick.type === "place"
        ? { placeId: venuePick.place.placeId, placeSessionToken: venuePick.sessionToken }
        : { venue: venuePick.name, city: venuePick.city || undefined }),
    seenAt: seenAt.toISOString(),
    isDay: draft.isDay,
    isNight: draft.isNight,
  };
}

/** Saves a checked draft (see draftProblem) as a review: new artists first,
 * then the night, its lineup and DJ reviews in one POST /reviews, then seeds
 * and refreshes every cache it shows up in. Resolves to the review's id. */
export function useLogNight() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { me } = useCurrentUser();

  const createDj = useMutation({
    mutationFn: (input: ICreateDjInput) => api.post<Dj>("/djs", input),
  });
  const createReview = useMutation({
    mutationFn: (input: CreateReviewInput) => api.post<Review>("/reviews", input),
  });

  const logNight = async (
    draft: IReviewDraft,
    caught: ILineupEntry[],
    {
      sourceReviewId,
      onDjSaved,
    }: {
      // The night it was filled in from, which stops prompting you to log it.
      sourceReviewId?: string;
      // A new artist was saved: swap it into the lineup, so a retry after a
      // failed log doesn't create it twice.
      onDjSaved: (key: string, dj: Dj) => void;
    },
  ) => {
    if (!me) throw new Error("Must be logged in to create a review");

    const djsByKey = new Map<string, Dj>();
    for (const entry of caught) {
      if (entry.pick.type === "existing") {
        djsByKey.set(entry.key, entry.pick.dj);
        continue;
      }
      const dj = await createDj.mutateAsync(entry.pick.input);
      djsByKey.set(entry.key, dj);
      onDjSaved(entry.key, dj);
    }
    const djFor = (entry: ILineupEntry) => djsByKey.get(entry.key)!;

    // The response is the whole post, as the feed and profiles show it.
    const post = await createReview.mutateAsync({
      ...logPlace(draft),
      rating: draft.rating!,
      reviewText: draft.reviewText.trim() || undefined,
      lineup: caught.map((e) => ({
        djId: djFor(e).id,
        ...(e.rating ? { rating: e.rating, reviewText: e.reviewText.trim() || undefined } : {}),
      })),
      tags: draft.tags,
      taggedUserIds: draft.taggedUsers.map((u) => u.id),
    });

    const reviewsKey = queryKeys.reviews.byUser(me.username);
    // Profiles list newest-seen first, so slot it in by seenAt rather than
    // at the top (a night seen last month belongs below last week's).
    queryClient.setQueryData<Paginated<Review>>(reviewsKey, (old) => ({
      items: [post, ...(old?.items ?? [])].sort((a, b) => new Date(b.seenAt).getTime() - new Date(a.seenAt).getTime()),
      nextCursor: old?.nextCursor ?? null,
    }));
    queryClient.setQueryData<Review>(queryKeys.reviews.byId(post.id), post);

    const stale = [
      reviewsKey,
      queryKeys.users.stats(me.username),
      ...post.lineup.map(({ dj }) => queryKeys.djs.bySlug(dj.slug)),
      ...(post.event ? [queryKeys.events.bySlug(post.event.slug)] : []),
      ...(post.venueId ? [queryKeys.venues.byId(post.venueId)] : []),
      ["venues", "search"],
      ["events", "list"],
      queryKeys.feed.activity(),
      queryKeys.feed.popular(),
      ["tags"],
      ...(sourceReviewId ? [queryKeys.reviews.byId(sourceReviewId)] : []),
      queryKeys.notifications.list(),
    ];
    for (const queryKey of stale) queryClient.invalidateQueries({ queryKey });

    return post.id;
  };

  return { logNight, pending: createDj.isPending || createReview.isPending };
}
