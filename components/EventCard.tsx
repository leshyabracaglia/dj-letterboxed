import { Text } from "react-native";

import type { Event } from "../lib/api/types";
import { formatDateTime } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { Card } from "./Card";

export function EventCard({ event }: { event: Event }) {
  return (
    <Card href={ROUTES.EVENT(event.id)}>
      <Text className="text-lg font-semibold text-ink">{event.name}</Text>
      <Text className="mt-1 text-sm text-muted">
        {event.venue}
        {event.city ? ` · ${event.city}` : ""}
      </Text>
      <Text className="mt-1 text-xs text-muted">{formatDateTime(event.eventDate)}</Text>
    </Card>
  );
}
