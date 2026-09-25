ALTER TABLE "reviews" RENAME COLUMN "rating_half_stars" TO "rating";--> statement-breakpoint
-- Half-star units (1-10) -> whole stars (1-5), rounding half stars up.
UPDATE "reviews" SET "rating" = ("rating" + 1) / 2 WHERE "rating" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5);
