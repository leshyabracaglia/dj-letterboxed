import type { Href } from "expo-router";

/**
 * Central source of truth for in-app routes. Use this instead of hardcoding
 * path strings in `Link`/`router.push`/`router.replace`/`Redirect` calls, so
 * a renamed or restructured route only needs to change here.
 */
export const ROUTES = {
  HOME: "/" as Href,
  SIGN_IN: "/(auth)/sign-in" as Href,
  SIGN_UP: "/(auth)/sign-up" as Href,
  ONBOARDING: "/(auth)/onboarding" as Href,
  FEED: "/(tabs)/feed" as Href,
  BROWSE: "/(tabs)/browse" as Href,
  LOG: "/(tabs)/log" as Href,
  PROFILE: "/(tabs)/profile" as Href,
  SETTINGS: "/settings" as Href,
  DJ: (slug: string): Href => `/dj/${slug}` as Href,
  EVENT: (id: string): Href => `/event/${id}` as Href,
  LOG_DETAIL: (id: string): Href => `/log/${id}` as Href,
  USER: (username: string): Href => `/user/${username}` as Href,
  USER_FOLLOWERS: (username: string): Href => `/user/${username}/followers` as Href,
  USER_FOLLOWING: (username: string): Href => `/user/${username}/following` as Href,
} as const;
