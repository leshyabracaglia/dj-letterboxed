import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import type { Dj } from "../lib/api/types";
import { ROUTES } from "../lib/routes";
import { Avatar, Text } from "./ui";

// DJs as avatar + name tiles (each opening the DJ's page), wrapping onto
// more rows for long lineups. `caption` goes under the name, e.g. a count.
export function DjAvatarRow({ items }: { items: { dj: Dj; caption?: ReactNode }[] }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map(({ dj, caption }) => (
        <Pressable key={dj.id} onPress={() => router.push(ROUTES.DJ(dj.slug))} className="w-20 items-center">
          <Avatar uri={dj.imageUrl} name={dj.name} size={56} />
          <Text className="mt-1 text-center font-display text-base uppercase leading-5 text-paper" numberOfLines={1}>
            {dj.name}
          </Text>
          {caption}
        </Pressable>
      ))}
    </View>
  );
}
