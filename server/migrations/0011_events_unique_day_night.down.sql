-- The old index can't tell a day party from a night party with the same
-- name, venue and date, so each such pair merges first into one day into
-- night event (the earliest created), taking the other's reviews and lineup.
CREATE TEMP TABLE "event_merges" AS
SELECT e."id" AS "drop_id", k."id" AS "keep_id"
FROM "events" e
JOIN LATERAL (
	SELECT k."id" FROM "events" k
	WHERE k."name" = e."name" AND k."venue_id" = e."venue_id" AND k."event_date" = e."event_date"
	ORDER BY k."created_at", k."id"
	LIMIT 1
) k ON k."id" <> e."id"
WHERE e."venue_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "events" k SET "is_day" = k."is_day" OR d."is_day", "is_night" = k."is_night" OR d."is_night"
FROM "event_merges" m
JOIN "events" d ON d."id" = m."drop_id"
WHERE k."id" = m."keep_id";
--> statement-breakpoint
UPDATE "reviews" r SET "event_id" = m."keep_id"
FROM "event_merges" m WHERE r."event_id" = m."drop_id";
--> statement-breakpoint
INSERT INTO "event_lineup" ("event_id", "dj_id", "added_by_user_id", "created_at")
SELECT m."keep_id", el."dj_id", el."added_by_user_id", el."created_at"
FROM "event_lineup" el JOIN "event_merges" m ON m."drop_id" = el."event_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Their remaining lineup rows go with them (ON DELETE CASCADE).
DELETE FROM "events" WHERE "id" IN (SELECT "drop_id" FROM "event_merges");
--> statement-breakpoint
DROP TABLE "event_merges";
--> statement-breakpoint
DROP INDEX "events_name_venue_id_date_day_night_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_id_date_idx" ON "events" ("name", "venue_id", "event_date") WHERE "venue_id" IS NOT NULL;
