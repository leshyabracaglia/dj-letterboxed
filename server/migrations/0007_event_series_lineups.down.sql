-- Night reviews (no DJ) can't exist without the nullable dj_id; they're
-- deleted. Lineups and series are dropped; events keep their names.
DELETE FROM "reviews" WHERE "dj_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_dj_or_event_check";
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "dj_id" SET NOT NULL;
--> statement-breakpoint
DROP TABLE "event_lineup";
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "series_id";
--> statement-breakpoint
DROP TABLE "event_series";
