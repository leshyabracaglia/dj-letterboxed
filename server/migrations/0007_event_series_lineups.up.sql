-- Recurring events ("Innervisions") become their own entity that individual
-- nights (events rows) point at, across venues and dates. Each night also
-- gets a lineup of the DJs people saw there, and a review no longer has to
-- be of one DJ: a review with no dj_id rates the night as a whole.
CREATE TABLE "event_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_series" ADD CONSTRAINT "event_series_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- One series per name, ignoring case.
CREATE UNIQUE INDEX "event_series_name_idx" ON "event_series" (lower("name"));
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "series_id" uuid;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_series_id_event_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."event_series"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "events_series_id_idx" ON "events" ("series_id");
--> statement-breakpoint
CREATE TABLE "event_lineup" (
	"event_id" uuid NOT NULL,
	"dj_id" uuid NOT NULL,
	"added_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_lineup_event_id_dj_id_pk" PRIMARY KEY("event_id","dj_id")
);
--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_dj_id_djs_id_fk" FOREIGN KEY ("dj_id") REFERENCES "public"."djs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_lineup" ADD CONSTRAINT "event_lineup_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Which events a DJ has played (series pages count nights per DJ).
CREATE INDEX "event_lineup_dj_id_idx" ON "event_lineup" ("dj_id");
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "dj_id" DROP NOT NULL;
--> statement-breakpoint
-- A night review (no DJ) only makes sense attached to a night.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_dj_or_event_check" CHECK ("dj_id" IS NOT NULL OR "event_id" IS NOT NULL);
--> statement-breakpoint
-- Backfill series: one per distinct event name. Events named after their
-- venue are the "no event name, just a night at the venue" case, not a
-- series. Slugs follow domain.Slugify, numbered on collision.
INSERT INTO "event_series" ("name", "slug", "created_by_user_id", "created_at")
SELECT "name",
	COALESCE(NULLIF("base", ''), 'event') || CASE WHEN "rn" > 1 THEN '-' || "rn" ELSE '' END,
	"created_by_user_id", "created_at"
FROM (
	SELECT *, row_number() OVER (PARTITION BY "base" ORDER BY "created_at") AS "rn"
	FROM (
		SELECT DISTINCT ON (lower("name")) "name", "created_by_user_id", "created_at",
			trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')) AS "base"
		FROM "events"
		WHERE lower("name") <> lower("venue")
		ORDER BY lower("name"), "created_at"
	) named
) numbered;
--> statement-breakpoint
UPDATE "events" e SET "series_id" = s."id"
FROM "event_series" s
WHERE lower(s."name") = lower(e."name") AND lower(e."name") <> lower(e."venue");
--> statement-breakpoint
-- Backfill lineups from the DJ reviews already logged against each night.
INSERT INTO "event_lineup" ("event_id", "dj_id", "added_by_user_id", "created_at")
SELECT DISTINCT ON ("event_id", "dj_id") "event_id", "dj_id", "user_id", "created_at"
FROM "reviews"
WHERE "event_id" IS NOT NULL AND "dj_id" IS NOT NULL
ORDER BY "event_id", "dj_id", "created_at";
