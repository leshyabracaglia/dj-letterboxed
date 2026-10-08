-- One-off production data fix. Two people logged the same night (KETTAMA at
-- Knockdown Center, 2026-10-07) under different event names, before events
-- could be picked by id, so it became two events in two one-night series:
-- "Kettama" (f0281cdd) and "Rush: Kettama" (d5727712). Merge the first into
-- the second: move its reviews and lineup over, delete it, and delete its
-- series if that leaves it with no events. Does nothing unless both events
-- exist, so it's a no-op on every database but production.
DO $$
DECLARE
	keep_id uuid := 'd5727712-46d7-4727-a129-1c146b69f0e5';
	drop_id uuid := 'f0281cdd-6110-4d6b-8c95-358f0a088f69';
	drop_series_id uuid := '1d8bf010-0a48-446a-93ea-46fb5f84f7cb';
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "events" WHERE "id" = keep_id)
		OR NOT EXISTS (SELECT 1 FROM "events" WHERE "id" = drop_id) THEN
		RETURN;
	END IF;

	UPDATE "reviews" SET "event_id" = keep_id WHERE "event_id" = drop_id;

	INSERT INTO "event_lineup" ("event_id", "dj_id", "added_by_user_id", "created_at")
	SELECT keep_id, "dj_id", "added_by_user_id", "created_at"
	FROM "event_lineup" WHERE "event_id" = drop_id
	ON CONFLICT DO NOTHING;

	-- Its remaining lineup rows go with it (ON DELETE CASCADE).
	DELETE FROM "events" WHERE "id" = drop_id;

	DELETE FROM "event_series" s
	WHERE s."id" = drop_series_id
		AND NOT EXISTS (SELECT 1 FROM "events" e WHERE e."series_id" = s."id");
END $$;
