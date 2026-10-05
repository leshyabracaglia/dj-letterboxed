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
  // `email` prefills the form (e.g. coming from settings' "forgot your
  // current password?").
  FORGOT_PASSWORD: (opts?: { email?: string }): Href =>
    `/(auth)/forgot-password${opts?.email ? `?email=${encodeURIComponent(opts.email)}` : ""}` as Href,
  ONBOARDING: "/(auth)/onboarding" as Href,
  FEED: "/(tabs)/feed" as Href,
  BROWSE: "/(tabs)/browse" as Href,
  REVIEW: "/(tabs)/review" as Href,
  PROFILE: "/(tabs)/profile" as Href,
  SETTINGS: "/settings" as Href,
  DJ: (slug: string): Href => `/dj/${slug}` as Href,
  // One night (an events row); SERIES is the recurring event it belongs to.
  EVENT: (id: string): Href => `/event/${id}` as Href,
  SERIES: (slug: string): Href => `/series/${slug}` as Href,
  VENUE: (id: string): Href => `/venue/${id}` as Href,
  // `justLogged` marks the landing right after creating the review, so the
  // page can prompt the author to share it.
  REVIEW_DETAIL: (id: string, opts?: { justLogged?: boolean }): Href =>
    `/review/${id}${opts?.justLogged ? "?justLogged=1" : ""}` as Href,
  USER: (username: string): Href => `/user/${username}` as Href,
  USER_FOLLOWERS: (username: string): Href => `/user/${username}/followers` as Href,
  USER_FOLLOWING: (username: string): Href => `/user/${username}/following` as Href,
} as const;
