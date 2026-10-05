-- Day vs night party becomes a property of the night (events row) picked
-- on every log, instead of optional 'day'/'night' tags. A party can be
-- both (day into night); a night with neither flag makes no sense.
ALTER TABLE "events" ADD COLUMN "is_day" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_night" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_day_or_night_check" CHECK ("is_day" OR "is_night");
--> statement-breakpoint
-- Backfill from tags: 'day' marks a day party; it stays a night party too
-- only if someone also tagged it 'night'.
UPDATE "events" e SET
	"is_day" = true,
	"is_night" = EXISTS (
		SELECT 1 FROM "reviews" r
		JOIN "review_tag_links" l ON l."review_id" = r."id"
		JOIN "tags" t ON t."id" = l."tag_id"
		WHERE r."event_id" = e."id" AND t."name" = 'night'
	)
WHERE EXISTS (
	SELECT 1 FROM "reviews" r
	JOIN "review_tag_links" l ON l."review_id" = r."id"
	JOIN "tags" t ON t."id" = l."tag_id"
	WHERE r."event_id" = e."id" AND t."name" = 'day'
);
--> statement-breakpoint
DELETE FROM "tags" WHERE "name" IN ('day', 'night');
--> statement-breakpoint
-- 'electric' is retired outright (off any reviews using it too); 'groovy'
-- joins the defaults.
DELETE FROM "tags" WHERE "name" = 'electric';
--> statement-breakpoint
INSERT INTO "tags" ("name", "is_default") VALUES ('groovy', true)
ON CONFLICT ("name") DO UPDATE SET "is_default" = true;
