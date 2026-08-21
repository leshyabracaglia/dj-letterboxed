import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Event } from "../lib/db/schema";

export function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/event/${event.id}`} asChild>
      <Pressable className="mb-3 rounded-xl border border-muted/20 bg-white p-4">
        <Text className="text-lg font-semibold text-ink">{event.name}</Text>
        <Text className="mt-1 text-sm text-muted">
          {event.venue}
          {event.city ? ` · ${event.city}` : ""}
        </Text>
        <Text className="mt-1 text-xs text-muted">
          {new Date(event.eventDate).toLocaleString()}
        </Text>
      </Pressable>
    </Link>
  );
}
