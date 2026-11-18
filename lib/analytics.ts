import { useSegments } from "expo-router";
import PostHog from "posthog-react-native";
import { useEffect, useRef } from "react";

import { useCurrentUser } from "./auth";

// Product analytics in PostHog: daily actives, retention, funnels. Off in
// development and wherever EXPO_PUBLIC_POSTHOG_KEY isn't set, so local runs
// and tests never send anything. Events carry no text anyone wrote and no
// location, only what kind of thing happened.
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const client =
  key && !__DEV__
    ? new PostHog(key, {
        host: process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        // App opened / backgrounded / installed / updated.
        captureAppLifecycleEvents: true,
      })
    : undefined;

/** What someone did, as `object_verb`. Add new ones here so the names stay
 * consistent across screens. */
export type AnalyticsEvent =
  | "onboarding_completed"
  | "night_logged"
  | "checked_in"
  | "user_followed"
  | "review_liked"
  | "comment_posted"
  | "id_suggested"
  | "id_accepted"
  | "list_created";

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  client?.capture(event, properties);
}

// Screen names are the route's pattern ("user/[username]"), not the path, so
// every profile counts as one screen and no usernames or ids go out.
function useScreenViews() {
  const segments = useSegments();
  const name = segments.filter((s) => !s.startsWith("(")).join("/") || "index";
  useEffect(() => {
    void client?.screen(name);
  }, [name]);
}

// Ties events to the signed-in account (by its id, plus the username for
// reading dashboards), and starts a fresh anonymous id after sign-out so the
// next person on the device isn't counted as them.
function useIdentify() {
  const { me, isSignedIn, isLoaded } = useCurrentUser();
  const identified = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!client) return;
    if (me) {
      client.identify(me.id, { username: me.username });
      identified.current = me.id;
    } else if (isLoaded && !isSignedIn && identified.current) {
      client.reset();
      identified.current = undefined;
    }
  }, [me, isSignedIn, isLoaded]);
}

/** Mount once inside AuthProvider; renders nothing. */
export function Analytics() {
  useScreenViews();
  useIdentify();
  return null;
}
