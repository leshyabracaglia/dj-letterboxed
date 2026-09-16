import { Link } from "expo-router";
import { Pressable } from "react-native";
import { Text } from "./Text";

import { ROUTES } from "../lib/routes";

export function BrandWordmark() {
  return (
    <Link href={ROUTES.FEED} asChild>
      <Pressable>
        <Text className="font-display text-4xl text-primary dark:text-primary-dark">
          BeatBox&apos;d
        </Text>
      </Pressable>
    </Link>
  );
}
