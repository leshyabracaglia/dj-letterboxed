import type { Event } from "../lib/api/types";
import { formatDateTime } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { Card, Text } from "./ui";

export function EventCard({ event }: { event: Event }) {
  return (
    <Card href={ROUTES.EVENT(event.id)} tint="accent">
      <Text className="text-lg font-semibold text-accent-text dark:text-accent-dark">{event.name}</Text>
      <Text className="mt-1 text-sm text-muted">
        {event.venue}
        {event.city ? ` · ${event.city}` : ""}
      </Text>
      <Text className="mt-1 text-xs text-muted">{formatDateTime(event.eventDate)}</Text>
    </Card>
  );
}
