-- Fails if a day and a night event now share name, venue and date; merge or
-- delete one of each such pair before rolling back.
DROP INDEX "events_name_venue_id_date_day_night_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_id_date_idx" ON "events" ("name", "venue_id", "event_date") WHERE "venue_id" IS NOT NULL;
