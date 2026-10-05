-- Unused ones go; any a review already uses stay as ordinary tags.
DELETE FROM "tags" t
WHERE t."name" IN ('day', 'night')
	AND NOT EXISTS (SELECT 1 FROM "review_tag_links" l WHERE l."tag_id" = t."id");
--> statement-breakpoint
UPDATE "tags" SET "is_default" = false WHERE "name" IN ('day', 'night');
