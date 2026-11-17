import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Avatar, Card, DashedButton, Icon, Stamp, Text } from "./ui";

import type { CheckInPost } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { formatCardDate, nightOfCheckIn } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

/** Someone was at a club and hasn't logged the night: who, where and which
 * night, with a "Log this night" for your own. Only you and your friends see
 * these. */
export function CheckInCard({ checkIn }: { checkIn: CheckInPost }) {
  const { me } = useCurrentUser();
  const { user, venue } = checkIn;
  const night = nightOfCheckIn(new Date(checkIn.createdAt));
  const mine = me?.id === user.id;
  const month = night.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  return (
    <Card tint="neutral" torn className="pb-5">
      <View className="flex-row gap-3 pr-20">
        <Pressable
          hitSlop={4}
          onPress={() => router.push(ROUTES.USER(user.username))}
          accessibilityRole="link"
          accessibilityLabel={`@${user.username}`}
          className="active:opacity-80"
        >
          <Avatar uri={user.avatarUrl} name={user.username} size={36} />
        </Pressable>
        <View className="flex-1">
          <Text variant="display" className="text-base uppercase text-zine-red-ink">
            {formatCardDate(night.toISOString())} · Checked in
          </Text>
          <Text variant="display" className="text-lg leading-5 text-paper/80">
            {mine ? "You were at" : `@${user.username} was at`}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => router.push(ROUTES.VENUE(venue.id))}
        accessibilityRole="link"
        className="mt-2 flex-row items-center gap-1.5 pr-20 active:opacity-80"
      >
        <Icon name="location" size={18} className="text-paper" />
        <Text variant="display" className="flex-1 text-3xl leading-8 text-paper" numberOfLines={2}>
          {venue.name}
        </Text>
      </Pressable>
      {!!venue.city && <Text className="pr-20 text-sm text-paper/60">{venue.city}</Text>}
      {mine && (
        <DashedButton
          label="Log this night"
          icon="add"
          onPress={() => router.push(ROUTES.REVIEW_FROM_CHECK_IN(venue.id, checkIn.createdAt))}
          className="mt-3 border-paper/50 py-2"
        />
      )}
      <View className="absolute right-3 top-3">
        <Stamp
          label={[month, String(night.getDate())]}
          rim="CHECKED IN · "
          size={64}
          rotate={8}
          accessibilityLabel={`Checked in ${formatCardDate(night.toISOString())}`}
        />
      </View>
    </Card>
  );
}
