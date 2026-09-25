import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useApi } from "./client";
import { queryKeys } from "./queryKeys";
import type {
  DjDetail,
  EventDetail,
  FavoriteReviewsResponse,
  FeedResponse,
  PopularResponse,
  UserProfile,
  VenueDetail,
} from "./types";

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
