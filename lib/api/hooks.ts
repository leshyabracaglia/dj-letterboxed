import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useApi } from "./client";
import { queryKeys } from "./queryKeys";
import type {
  DjDetail,
  EventDetail,
  FeedResponse,
  LeaderboardEntry,
  PopularResponse,
  UserProfile,
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

export function useFeed() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: queryKeys.feed.activity(),
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.get<FeedResponse>("/feed", { cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
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

export function useLeaderboard(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.users.leaderboard(),
    queryFn: () => api.get<LeaderboardEntry[]>("/leaderboard"),
    enabled,
  });
}
