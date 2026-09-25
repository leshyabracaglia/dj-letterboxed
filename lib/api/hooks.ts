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
  UserProfile,
  VenueDetail,
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

// Searches local DJs. Idle until `query` is non-empty (and `enabled`); keeps
// showing the previous results while the next keystroke's search loads.
export function useDjSearch(query: string, enabled: boolean = true) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.djs.search(query),
    queryFn: () => api.get<Dj[]>("/djs/search", { q: query }),
    enabled: enabled && query.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useUserProfile(username: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.users.byUsername(username!),
    queryFn: () => api.get<UserProfile>(`/users/${username}`),
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

export function useVenueDetail(venue: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.venues.byName(venue!),
    queryFn: () => api.get<VenueDetail>(`/venues/${encodeURIComponent(venue!)}`),
    enabled: venue !== undefined,
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
