import { useAuth } from "@clerk/expo";

// Web has no push notifications (expo-notifications is native-only); see
// lib/push.ts for the native implementation these mirror.

export function usePushNotifications() {}

export function useSignOut() {
  return useAuth().signOut;
}
