import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Icon, Text } from "./ui";
import { useUnreadNotificationCount } from "../lib/api/hooks";
import { ROUTES } from "../lib/routes";

const MAX_UNREAD_NOTIFICATIONS = 20;

/** Opens the notifications list, with a count of unread ones. Signed-in
 * only: callers leave it out for signed-out visitors. */
export function NotificationsBell() {
  const numUnreadNotifs = useUnreadNotificationCount();
  return (
    <Pressable
      onPress={() => router.push(ROUTES.NOTIFICATIONS)}
      accessibilityLabel={numUnreadNotifs ? `Notifications, ${numUnreadNotifs} unread` : "Notifications"}
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-xl bg-black/85 active:opacity-80"
    >
      <Icon name={numUnreadNotifs ? "notifications" : "notifications-outline"} size={20} className="text-paper" />
      {!!numUnreadNotifs && (
        <View className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1">
          <Text className="font-display text-sm leading-4 text-paper">
            {numUnreadNotifs > MAX_UNREAD_NOTIFICATIONS ? `${MAX_UNREAD_NOTIFICATIONS}+` : numUnreadNotifs}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
