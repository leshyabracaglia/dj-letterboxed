DELETE FROM "notifications" WHERE "type" IN ('id_suggested', 'id_accepted');
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
	CHECK ("type" IN ('follow', 'like', 'comment', 'tag'));
DROP TABLE "track_suggestions";
ALTER TABLE "review_tracks" DROP COLUMN "identified_by_user_id";
