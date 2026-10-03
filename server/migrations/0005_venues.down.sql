DROP INDEX "events_name_venue_date_idx";
--> statement-breakpoint
DROP INDEX "events_name_venue_id_date_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX "events_name_venue_date_idx" ON "events" USING btree ("name","venue","event_date");
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "venue_id";
--> statement-breakpoint
DROP TABLE "venues";
