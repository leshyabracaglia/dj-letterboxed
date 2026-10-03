-- Venues become their own entity, optionally linked to a Google Places
-- place id, so events at the same place share one row (and one venue page)
-- instead of being grouped by an exact venue-name string.
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"city" varchar(120),
	"address" text,
	"google_place_id" varchar(255),
	"latitude" double precision,
	"longitude" double precision,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- One row per Google place; venues typed in by hand (no place id) are
-- deduped case-insensitively by name instead.
CREATE UNIQUE INDEX "venues_google_place_id_idx" ON "venues" ("google_place_id") WHERE "google_place_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "venues_unlinked_name_idx" ON "venues" (lower("name")) WHERE "google_place_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue_id" uuid;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "events_venue_id_idx" ON "events" ("venue_id");
--> statement-breakpoint
-- Backfill: every distinct venue string becomes an unlinked venue (city
-- taken from its most recent event), and its events point at it.
INSERT INTO "venues" ("name", "city")
SELECT DISTINCT ON (lower("venue")) "venue", "city"
FROM "events"
ORDER BY lower("venue"), "event_date" DESC;
--> statement-breakpoint
UPDATE "events" e SET "venue_id" = v."id"
FROM "venues" v
WHERE v."google_place_id" IS NULL AND lower(v."name") = lower(e."venue");
--> statement-breakpoint
-- Event dedupe moves from the venue string to the venue id (two different
-- places can share a name). Rows without a venue id keep the old rule.
DROP INDEX "events_name_venue_date_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_id_date_idx" ON "events" ("name", "venue_id", "event_date") WHERE "venue_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_date_idx" ON "events" ("name", "venue", "event_date") WHERE "venue_id" IS NULL;
