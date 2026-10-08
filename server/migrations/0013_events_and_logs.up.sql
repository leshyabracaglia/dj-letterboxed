-- Events stop being nights. An event is now just a named party
-- ("Innervisions NY") - what event_series was - and each person's night out
-- becomes a log: which event (optional), venue, day, day/night, and the DJs
-- they saw. Reviews hang off a log instead of a shared night, so people at
-- the same party can have gone during the day or at night, or on different
-- dates, without splitting it into separate events.
--
-- Data: every series becomes an event; every (user, night) a user reviewed
-- becomes one log carrying that night's venue, date, day/night and lineup;
-- a review with no night becomes a log of its own. Night descriptions have
-- no home in the new model and are dropped.

-- A named night with no series (named something other than its venue)
-- would lose its name below; make it a series first, as 0007's backfill did
-- for the nights that existed then. Slugs follow domain.Slugify, numbered
-- past any existing or new collision.
INSERT INTO "event_series" ("name", "slug", "created_by_user_id", "created_at")
SELECT "name",
	COALESCE(NULLIF("base", ''), 'event')
		|| CASE WHEN "rn" + "taken" > 1 THEN '-' || ("rn" + "taken") ELSE '' END,
	"created_by_user_id", "created_at"
FROM (
	SELECT *,
		row_number() OVER (PARTITION BY "base" ORDER BY "created_at") AS "rn",
		(SELECT COUNT(*) FROM "event_series" s
			WHERE s."slug" = "base" OR s."slug" ~ ('^' || "base" || '-[0-9]+$')) AS "taken"
	FROM (
		SELECT DISTINCT ON (lower(e."name")) e."name", e."created_by_user_id", e."created_at",
			trim(BOTH '-' FROM regexp_replace(lower(e."name"), '[^a-z0-9]+', '-', 'g')) AS "base"
		FROM "events" e
		WHERE e."series_id" IS NULL AND lower(e."name") <> lower(e."venue")
			AND NOT EXISTS (SELECT 1 FROM "event_series" s WHERE lower(s."name") = lower(e."name"))
		ORDER BY lower(e."name"), e."created_at"
	) named
) numbered;
--> statement-breakpoint
UPDATE "events" e SET "series_id" = s."id"
FROM "event_series" s
WHERE e."series_id" IS NULL AND lower(e."name") <> lower(e."venue") AND lower(s."name") = lower(e."name");
--> statement-breakpoint
-- reviews was created as "logs" (renamed in 0001); its primary key index
-- kept the old name, which the new logs table needs.
ALTER INDEX IF EXISTS "logs_pkey" RENAME TO "reviews_pkey";
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid,
	-- Venue display name, denormalized alongside venue_id like events.venue
	-- was. Only logs migrated from venue-less reviews lack one.
	"venue" varchar(160),
	"venue_id" uuid,
	"city" varchar(120),
	"seen_at" timestamp with time zone NOT NULL,
	"is_day" boolean DEFAULT false NOT NULL,
	"is_night" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	-- Migration bookkeeping, dropped at the end.
	"old_event_id" uuid,
	"old_review_id" uuid,
	CONSTRAINT "logs_day_or_night_check" CHECK ("is_day" OR "is_night")
);
--> statement-breakpoint
-- One log per user per night they reviewed.
INSERT INTO "logs" ("user_id", "event_id", "venue", "venue_id", "city", "seen_at", "is_day", "is_night", "created_at", "old_event_id")
SELECT r."user_id", e."series_id", e."venue", e."venue_id", e."city", e."event_date", e."is_day", e."is_night", MIN(r."created_at"), e."id"
FROM "reviews" r
JOIN "events" e ON e."id" = r."event_id"
GROUP BY r."user_id", e."id";
--> statement-breakpoint
-- A review that was never tied to a night is a log of its own.
INSERT INTO "logs" ("user_id", "seen_at", "created_at", "old_review_id")
SELECT "user_id", "seen_at", "created_at", "id"
FROM "reviews"
WHERE "event_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "log_id" uuid;
--> statement-breakpoint
UPDATE "reviews" r SET "log_id" = l."id"
FROM "logs" l
WHERE l."old_event_id" = r."event_id" AND l."user_id" = r."user_id";
--> statement-breakpoint
UPDATE "reviews" r SET "log_id" = l."id"
FROM "logs" l
WHERE l."old_review_id" = r."id";
--> statement-breakpoint
-- Each log's lineup: the whole night's lineup as it was (everyone's
-- additions), plus any DJ the user reviewed that somehow wasn't on it.
CREATE TABLE "log_lineup" (
	"log_id" uuid NOT NULL,
	"dj_id" uuid NOT NULL,
	CONSTRAINT "log_lineup_log_id_dj_id_pk" PRIMARY KEY("log_id","dj_id")
);
--> statement-breakpoint
INSERT INTO "log_lineup" ("log_id", "dj_id")
SELECT l."id", el."dj_id"
FROM "logs" l
JOIN "event_lineup" el ON el."event_id" = l."old_event_id";
--> statement-breakpoint
INSERT INTO "log_lineup" ("log_id", "dj_id")
SELECT DISTINCT "log_id", "dj_id" FROM "reviews" WHERE "dj_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_dj_or_event_check";
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "event_id";
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "log_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "logs" DROP COLUMN "old_event_id";
--> statement-breakpoint
ALTER TABLE "logs" DROP COLUMN "old_review_id";
--> statement-breakpoint
-- The nights go; series take over the events name.
DROP TABLE "event_lineup";
--> statement-breakpoint
DROP TABLE "events";
--> statement-breakpoint
ALTER TABLE "event_series" RENAME TO "events";
--> statement-breakpoint
ALTER INDEX "event_series_pkey" RENAME TO "events_pkey";
--> statement-breakpoint
ALTER TABLE "events" RENAME CONSTRAINT "event_series_slug_unique" TO "events_slug_unique";
--> statement-breakpoint
ALTER INDEX "event_series_name_idx" RENAME TO "events_name_idx";
--> statement-breakpoint
ALTER TABLE "events" RENAME CONSTRAINT "event_series_created_by_user_id_users_id_fk" TO "events_created_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "log_lineup" ADD CONSTRAINT "log_lineup_log_id_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."logs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "log_lineup" ADD CONSTRAINT "log_lineup_dj_id_djs_id_fk" FOREIGN KEY ("dj_id") REFERENCES "public"."djs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_log_id_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."logs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "logs_user_id_idx" ON "logs" ("user_id");
--> statement-breakpoint
CREATE INDEX "logs_event_id_idx" ON "logs" ("event_id");
--> statement-breakpoint
CREATE INDEX "logs_venue_id_idx" ON "logs" ("venue_id");
--> statement-breakpoint
CREATE INDEX "log_lineup_dj_id_idx" ON "log_lineup" ("dj_id");
--> statement-breakpoint
CREATE INDEX "reviews_log_id_idx" ON "reviews" ("log_id");
