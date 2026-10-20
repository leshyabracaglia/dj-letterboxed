DELETE FROM "notifications" WHERE "type" = 'here_too';
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_venue_check";
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_review_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_check1" CHECK (("type" = 'follow') = ("review_id" IS NULL));
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
	CHECK ("type" IN ('follow', 'like', 'comment', 'tag', 'id_suggested', 'id_accepted'));
ALTER TABLE "notifications" DROP COLUMN "venue_id";
