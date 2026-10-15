import { useAuth } from "@clerk/expo";
import Constants from "expo-constants";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";

import { useApi } from "./api/client";
import { queryKeys } from "./api/queryKeys";
import type { PushTokenInput } from "./api/types";
import { ROUTES } from "./routes";

// Push notifications for follows, likes, comments and tags (sent by
// server/internal/httpapi/notify.go), and the nudge that people you follow
// logged nights while you were away (reengage.go). Native only: lib/push.web.ts stubs
// this out, since expo-notifications doesn't support web.

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// This device's token once registered, so sign-out can unregister it.
let registeredToken: string | undefined;

async function getPushToken(): Promise<string | undefined> {
  // Android 13+ won't show the permission prompt until a channel exists.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status === "undetermined") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return undefined;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

// The server sends what happened, not a path; routes stay in ROUTES.
function routeFor(data: Record<string, unknown> | undefined) {
  if (data?.type === "follow" && typeof data.username === "string") {
    return ROUTES.USER(data.username);
  }
  if ((data?.type === "like" || data?.type === "comment" || data?.type === "tag") && typeof data.reviewId === "string") {
    return ROUTES.REVIEW_DETAIL(data.reviewId);
  }
  if (data?.type === "following_logs") return ROUTES.FEED;
  return undefined;
}

function openNotification(response: Notifications.NotificationResponse) {
  const route = routeFor(response.notification.request.content.data);
  if (route) router.push(route);
}

/** Registers this device for the signed-in user's notifications (asking for
 * permission the first time) and opens the right screen when one is
 * tapped. Mount once, inside AuthProvider. */
export function usePushNotifications() {
  const { isSignedIn } = useAuth();
  const api = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getPushToken();
        if (!token || cancelled) return;
        const body: PushTokenInput = { token, platform: Platform.OS };
        await api.post("/users/me/push-tokens", body);
        registeredToken = token;
      } catch (err) {
        // No token on simulators or Expo Go; the app works fine without.
        console.warn("Push notification registration failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, api]);

  useEffect(() => {
    // A tap that launched the app from closed, then any later ones.
    const launch = Notifications.getLastNotificationResponse();
    if (launch) {
      openNotification(launch);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(openNotification);
    // Each push is also a new entry in the in-app list and its badge.
    const received = Notifications.addNotificationReceivedListener(() =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() }),
    );
    return () => {
      sub.remove();
      received.remove();
    };
  }, [queryClient]);
}

/** Clerk's signOut, after unregistering this device so the account's
 * notifications stop arriving here. Use instead of useAuth().signOut. */
export function useSignOut() {
  const { signOut } = useAuth();
  const api = useApi();
  return useCallback(async () => {
    const token = registeredToken;
    if (token) {
      const body: PushTokenInput = { token, platform: Platform.OS };
      // Best effort: never block signing out on it.
      await api.del("/users/me/push-tokens", body).catch(() => {});
      registeredToken = undefined;
    }
    await signOut();
  }, [api, signOut]);
}
