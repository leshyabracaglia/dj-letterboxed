import type { Dj } from "../lib/api/types";
import { ROUTES } from "../lib/routes";
import { Card } from "./Card";
import { Text } from "./Text";

export function DjCard({ dj }: { dj: Dj }) {
  return (
    <Card href={ROUTES.DJ(dj.slug)} tint="primary">
      <Text className="text-lg font-semibold text-primary dark:text-primary-dark">{dj.name}</Text>
      {dj.genres && dj.genres.length > 0 ? (
        <Text className="mt-1 text-sm text-muted">{dj.genres.join(" · ")}</Text>
      ) : null}
    </Card>
  );
}
