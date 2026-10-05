CREATE TYPE "public"."crowd_vibe" AS ENUM('electric', 'good', 'average', 'dead');
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "crowd_vibe" "crowd_vibe";
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "crowd_vibe_note" varchar(280);
--> statement-breakpoint
-- Best effort: restore crowd_vibe from the tags the up migration mapped it
-- to. Every other tag is lost.
UPDATE "reviews" r SET "crowd_vibe" = (
	SELECT (CASE t."name"
		WHEN 'electric' THEN 'electric'
		WHEN 'good vibes' THEN 'good'
		WHEN 'mid' THEN 'average'
		WHEN 'dead floor' THEN 'dead'
	END)::"crowd_vibe"
	FROM "review_tag_links" l
	JOIN "tags" t ON t."id" = l."tag_id"
	WHERE l."review_id" = r."id" AND t."name" IN ('electric', 'good vibes', 'mid', 'dead floor')
	LIMIT 1
);
--> statement-breakpoint
DROP TABLE "review_tag_links";
--> statement-breakpoint
DROP TABLE "tags";
