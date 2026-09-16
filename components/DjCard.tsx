import { View } from "react-native";

import type { Dj } from "../lib/api/types";
import { ROUTES } from "../lib/routes";
import { Avatar } from "./Avatar";
import { Card } from "./Card";
import { GenreTags } from "./GenreTags";
import { Text } from "./Text";

export function DjCard({ dj }: { dj: Dj }) {
  return (
    <Card href={ROUTES.DJ(dj.slug)} tint="primary">
      <View className="flex-row items-center gap-3">
        <Avatar uri={dj.imageUrl} name={dj.name} size={48} />
        <View className="flex-1">
          <Text className="text-lg font-semibold text-primary dark:text-primary-dark">
            {dj.name}
          </Text>
          {dj.genres && dj.genres.length > 0 ? (
            <View className="mt-1.5">
              <GenreTags genres={dj.genres} limit={3} />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
