ALTER TABLE "reviews" DROP CONSTRAINT "reviews_rating_range";--> statement-breakpoint
UPDATE "reviews" SET "rating" = "rating" * 2 WHERE "rating" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" RENAME COLUMN "rating" TO "rating_half_stars";
