-- Back to series + nights. Named events become series again, and nights are
-- rebuilt from logs: one per event (or none) + venue + calendar day +
-- day/night, with the union of those logs' lineups. Lossy the other way
-- from 0013's up: logs that up merged by night stay merged, separate logs
-- that land on the same night merge into it, and night descriptions (dropped
-- by the up) don't come back. Logs without a venue (reviews that never had a
-- night) go back to reviews with no event.

ALTER TABLE "logs" DROP CONSTRAINT "logs_event_id_events_id_fk";
--> statement-breakpoint
ALTER TABLE "events" RENAME TO "event_series";
--> statement-breakpoint
ALTER INDEX "events_pkey" RENAME TO "event_series_pkey";
--> statement-breakpoint
ALTER TABLE "event_series" RENAME CONSTRAINT "events_slug_unique" TO "event_series_slug_unique";
--> statement-breakpoint
ALTER INDEX "events_name_idx" RENAME TO "event_series_name_idx";
--> statement-breakpoint
ALTER TABLE "event_series" RENAME CONSTRAINT "events_created_by_user_id_users_id_fk" TO "event_series_created_by_user_id_users_id_fk";
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"venue" varchar(160) NOT NULL,
	"city" varchar(120),
	"event_date" timestamp with time zone NOT NULL,
	"description" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"venue_id" uuid,
	"series_id" uuid,
	"is_day" boolean DEFAULT false NOT NULL,
	"is_night" boolean DEFAULT true NOT NULL,
	CONSTRAINT "events_day_or_night_check" CHECK ("is_day" OR "is_night")
);
--> statement-breakpoint
-- One night per distinct (event, venue, day, day/night) among logs with a
-- venue; named after its series, or its venue when it has none.
INSERT INTO "events" ("name", "venue", "city", "event_date", "created_by_user_id", "created_at", "venue_id", "series_id", "is_day", "is_night")
SELECT COALESCE(s."name", l."venue"), l."venue", MAX(l."city"), MIN(l."seen_at"),
	(ARRAY_AGG(l."user_id" ORDER BY l."created_at"))[1], MIN(l."created_at"),
	l."venue_id", l."event_id", l."is_day", l."is_night"
FROM "logs" l
LEFT JOIN "event_series" s ON s."id" = l."event_id"
WHERE l."venue" IS NOT NULL
GROUP BY l."event_id", s."name", l."venue_id", l."venue", (l."seen_at" AT TIME ZONE 'UTC')::date, l."is_day", l."is_night";
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "event_id" uuid;
--> statement-breakpoint
UPDATE "reviews" r SET "event_id" = e."id"
FROM "logs" l, "events" e
WHERE l."id" = r."log_id"
	AND e."series_id" IS NOT DISTINCT FROM l."event_id"
	AND e."venue_id" IS NOT DISTINCT FROM l."venue_id"
	AND e."venue" = l."venue"
	AND (e."event_date" AT TIME ZONE 'UTC')::date = (l."seen_at" AT TIME ZONE 'UTC')::date
	AND e."is_day" = l."is_day" AND e."is_night" = l."is_night";
--> statement-breakpoint
CREATE TABLE "event_lineup" (
	"event_id" uuid NOT NULL,
	"dj_id" uuid NOT NULL,
	"added_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_lineup_event_id_dj_id_pk" PRIMARY KEY("event_id","dj_id")
);
--> statement-breakpoint
INSERT INTO "event_lineup" ("event_id", "dj_id", "added_by_user_id", "created_at")
SELECT DISTINCT ON (r."event_id", ll."dj_id") r."event_id", ll."dj_id", l."user_id", l."created_at"
FROM "log_lineup" ll
JOIN "logs" l ON l."id" = ll."log_id"
JOIN "reviews" r ON r."log_id" = l."id"
WHERE r."event_id" IS NOT NULL
ORDER BY r."event_id", ll."dj_id", l."created_at";
--> statement-breakpoint
-- Night reviews (no DJ) whose log had no venue have no night to attach to.
DELETE FROM "reviews" WHERE "dj_id" IS NULL AND "event_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "log_id";
--> statement-breakpoint
DROP TABLE "log_lineup";
--> statement-breakpoint
DROP TABLE "logs";
--> statement-breakpoint
ALTER INDEX IF EXISTS "reviews_pkey" RENAME TO "logs_pkey";
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_dj_or_event_check" CHECK ("dj_id" IS NOT NULL OR "event_id" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_dj_id_djs_id_fk" FOREIGN KEY ("dj_id") REFERENCES "public"."djs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_lineup_dj_id_idx" ON "event_lineup" ("dj_id");
--> statement-breakpoint
CREATE INDEX "events_venue_id_idx" ON "events" ("venue_id");
--> statement-breakpoint
CREATE INDEX "events_series_id_idx" ON "events" ("series_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_id_date_day_night_idx" ON "events" ("name", "venue_id", "event_date", "is_day", "is_night") WHERE "venue_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_date_idx" ON "events" ("name", "venue", "event_date") WHERE "venue_id" IS NULL;
