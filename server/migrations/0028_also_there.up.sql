-- "Also there": someone you follow, who follows you back, logged the same
-- night as you. One per friend per night.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
	CHECK ("type" IN ('follow', 'like', 'comment', 'tag', 'id_suggested', 'id_accepted', 'also_there'));
CREATE UNIQUE INDEX "notifications_also_there_uniq" ON "notifications" ("user_id", "actor_id", "review_id") WHERE "type" = 'also_there';
