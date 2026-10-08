-- A venue can host different events on the same day - a day party and a
-- separate night party - which can share a name and, since a log's seenAt is
-- midday of the logged day, the same event_date. The venue-id dedupe index
-- from 0005 has to tell them apart by the day/night flags too, or creating
-- the second one fails. (One party running day into night is a single event
-- with both flags; reviews attach to it by id.) Rows without a venue id keep
-- their old rule.
DROP INDEX "events_name_venue_id_date_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_id_date_day_night_idx" ON "events" ("name", "venue_id", "event_date", "is_day", "is_night") WHERE "venue_id" IS NOT NULL;
