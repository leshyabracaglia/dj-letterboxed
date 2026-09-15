DROP TABLE IF EXISTS "review_comments" CASCADE;
DROP TABLE IF EXISTS "review_likes" CASCADE;

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_user_id_users_id_fk";
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_dj_id_djs_id_fk";
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_event_id_events_id_fk";

ALTER TABLE "reviews" RENAME TO "logs";

ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "logs" ADD CONSTRAINT "logs_dj_id_djs_id_fk" FOREIGN KEY ("dj_id") REFERENCES "public"."djs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "logs" ADD CONSTRAINT "logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
