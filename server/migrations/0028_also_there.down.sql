DROP INDEX "notifications_also_there_uniq";
DELETE FROM "notifications" WHERE "type" = 'also_there';
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
	CHECK ("type" IN ('follow', 'like', 'comment', 'tag', 'id_suggested', 'id_accepted'));
