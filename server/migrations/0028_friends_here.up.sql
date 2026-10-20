-- "Your friend's here too": when two friends (each follows the other) check
-- in at the same venue the same night, each is told about the other. These
-- notifications are about a venue (venue_id), not a night out, so like a
-- follow they have no review_id.
ALTER TABLE "notifications" ADD COLUMN "venue_id" uuid REFERENCES "venues" ("id") ON DELETE CASCADE;

ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
	CHECK ("type" IN ('follow', 'like', 'comment', 'tag', 'id_suggested', 'id_accepted', 'here_too'));

-- The unnamed CHECK ((type = 'follow') = (review_id IS NULL)) from 0018,
-- found by what it says rather than the name Postgres gave it.
DO $$
DECLARE c text;
BEGIN
	SELECT conname INTO c FROM pg_constraint
	WHERE conrelid = 'notifications'::regclass AND contype = 'c'
		AND pg_get_constraintdef(oid) LIKE '%''follow''%review_id IS NULL%';
	EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', c);
END $$;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_review_check"
	CHECK (("type" IN ('follow', 'here_too')) = ("review_id" IS NULL));
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_venue_check"
	CHECK (("type" = 'here_too') = ("venue_id" IS NOT NULL));
