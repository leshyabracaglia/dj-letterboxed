import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Dj } from "../lib/api/types";
import { ROUTES } from "../lib/routes";

export function DjCard({ dj }: { dj: Dj }) {
  return (
    <Link href={ROUTES.DJ(dj.slug)} asChild>
      <Pressable className="mb-3 rounded-xl border border-muted/20 bg-white p-4">
        <Text className="text-lg font-semibold text-ink">{dj.name}</Text>
        {dj.genres && dj.genres.length > 0 ? (
          <Text className="mt-1 text-sm text-muted">{dj.genres.join(" · ")}</Text>
        ) : null}
      </Pressable>
    </Link>
  );
}
