-- 'groovy' goes back to an ordinary tag (dropped if unused); 'electric'
-- is a default again (the reviews it was removed from stay without it).
DELETE FROM "tags" t
WHERE t."name" = 'groovy'
	AND NOT EXISTS (SELECT 1 FROM "review_tag_links" l WHERE l."tag_id" = t."id");
--> statement-breakpoint
UPDATE "tags" SET "is_default" = false WHERE "name" = 'groovy';
--> statement-breakpoint
INSERT INTO "tags" ("name", "is_default") VALUES ('electric', true)
ON CONFLICT ("name") DO UPDATE SET "is_default" = true;
--> statement-breakpoint
INSERT INTO "tags" ("name", "is_default") VALUES ('day', true), ('night', true)
ON CONFLICT ("name") DO UPDATE SET "is_default" = true;
--> statement-breakpoint
-- Best effort: day parties get the 'day' tag back on their reviews, and day
-- into night parties 'night' too (plain nights were never tagged).
INSERT INTO "review_tag_links" ("review_id", "tag_id")
SELECT r."id", t."id"
FROM "reviews" r
JOIN "events" e ON e."id" = r."event_id"
JOIN "tags" t ON (t."name" = 'day') OR (t."name" = 'night' AND e."is_night")
WHERE e."is_day"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_day_or_night_check";
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "is_night";
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "is_day";
