import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useApi } from "./client";
import { queryKeys } from "./queryKeys";
import type {
  Dj,
  DjDetail,
  EventDetail,
  FavoriteReviewsResponse,
  FeedResponse,
  Paginated,
  PopularResponse,
  Review,
  SeriesSummary,
  User,
  UserProfile,
  UserStats,
  VenueDetail,
  VenueSummary,
} from "./types";

// The review tab writes a freshly created review into this same cache entry
// (queryKeys.reviews.byUser), so keep the key and page size in one place.
export function useUserReviews(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.reviews.byUser(username ?? ""),
    queryFn: () => api.get<Paginated<Review>>(`/users/${username}/reviews`, { limit: 20 }),
    enabled: !!username,
  });
}

// How many popular rows a browse search shows before anything is typed.
const SUGGESTION_COUNT = 5;

interface SearchOptions {
  enabled?: boolean;
  // With an empty query, fetch the top few (most-reviewed / busiest /
  // most-followed) instead of staying idle.
  suggest?: boolean;
}

// Searches local DJs. Idle until `query` is non-empty (and `enabled`) unless
// `suggest`; keeps showing the previous results while the next keystroke's
// search loads.
export function useDjSearch(query: string, { enabled = true, suggest = false }: SearchOptions = {}) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.djs.search(query),
    queryFn: () =>
      api.get<Dj[]>("/djs/search", query ? { q: query } : { limit: SUGGESTION_COUNT }),
    enabled: enabled && (suggest || !!query.length),
    placeholderData: keepPreviousData,
  });
}

export function useVenueSearch(
  query: string,
  { enabled = true, suggest = false }: SearchOptions = {},
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.venues.search(query),
    queryFn: () =>
      api.get<VenueSummary[]>(
        "/venues/search",
        query ? { q: query } : { limit: SUGGESTION_COUNT },
      ),
    enabled: enabled && (suggest || !!query.length),
    placeholderData: keepPreviousData,
  });
}

// Event series by name, most-reviewed first; an empty query lists them all
// (the browse index). Keeps the previous results while typing.
export function useSeriesSearch(query: string, enabled: boolean = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.series.list(query),
    queryFn: () => api.get<SeriesSummary[]>("/series", query ? { q: query } : undefined),
    enabled,
    placeholderData: keepPreviousData,
  });
}

// Searches users by username/display name. Idle until `query` reaches
// `minLength` (and `enabled`) unless `suggest` and the query is empty; keeps
// the previous results while typing.
export function useUserSearch(
  query: string,
  { enabled = true, suggest = false, minLength = 1 }: SearchOptions & { minLength?: number } = {},
) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.users.search(query),
    queryFn: () =>
      api.get<User[]>("/users/search", query ? { q: query } : { limit: SUGGESTION_COUNT }),
    enabled: enabled && (query.length >= minLength || (suggest && !query.length)),
    placeholderData: keepPreviousData,
  });
}

export function useUserProfile(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.users.byUsername(username!),
    queryFn: () => api.get<UserProfile>(`/users/${username}`),
    enabled: !!username,
  });
}

export function useDjDetail(slug: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.djs.bySlug(slug!),
    queryFn: () => api.get<DjDetail>(`/djs/${slug}`),
  });
}

export function useEventDetail(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.events.byId(id!),
    queryFn: () => api.get<EventDetail>(`/events/${id}`),
  });
}

export function useVenueDetail(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.venues.byId(id!),
    queryFn: () => api.get<VenueDetail>(`/venues/${id}`),
    enabled: id !== undefined,
  });
}

// Shared by the profile header's counts row (DJ count) and StatsSummary.
export function useUserStats(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.users.stats(username!),
    queryFn: () => api.get<UserStats>(`/users/${username}/stats`),
    enabled: username !== undefined,
  });
}

export function useFavoriteReviews(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.users.favorites(username!),
    queryFn: () => api.get<FavoriteReviewsResponse>(`/users/${username}/favorites`),
    enabled: username !== undefined,
  });
}

export function useFeed(enabled: boolean = true) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.feed.activity(),
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.get<FeedResponse>("/feed", { cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

export function usePopularFeed(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.feed.popular(),
    queryFn: () => api.get<PopularResponse>("/feed/popular", { limit: 20 }),
    enabled,
  });
}
