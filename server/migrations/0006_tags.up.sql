-- Free-form tags replace the fixed crowd_vibe enum: a shared library of tag
-- names (seeded with some defaults, grown by users adding their own) that
-- reviews link to. Not to be confused with review_tags, which tags *users*
-- on a review.
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	-- Stored normalized (trimmed, single-spaced, lowercase - see
	-- domain.NormalizeTag), so a plain unique index dedupes.
	"name" varchar(32) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "review_tag_links" (
	"review_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_tag_links_review_id_tag_id_pk" PRIMARY KEY("review_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "review_tag_links" ADD CONSTRAINT "review_tag_links_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "review_tag_links" ADD CONSTRAINT "review_tag_links_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Usage counts per tag (the library is ordered by them).
CREATE INDEX "review_tag_links_tag_id_idx" ON "review_tag_links" ("tag_id");
--> statement-breakpoint
INSERT INTO "tags" ("name", "is_default") VALUES
	('older crowd', true),
	('younger crowd', true),
	('drunk crowd', true),
	('relaxed', true),
	('overwhelming', true),
	('electric', true),
	('good vibes', true),
	('packed', true),
	('half empty', true),
	('dead floor', true),
	('dancey', true),
	('chatty crowd', true),
	('phones out', true),
	('friendly', true),
	('sweaty', true),
	('intimate', true),
	('great sound', true),
	('bad sound', true),
	('long queue', true);
--> statement-breakpoint
-- Backfill: each old crowd_vibe becomes the matching tag.
INSERT INTO "tags" ("name") VALUES ('mid') ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "review_tag_links" ("review_id", "tag_id", "created_at")
SELECT r."id", t."id", r."created_at"
FROM "reviews" r
JOIN "tags" t ON t."name" = CASE r."crowd_vibe"
	WHEN 'electric' THEN 'electric'
	WHEN 'good' THEN 'good vibes'
	WHEN 'average' THEN 'mid'
	WHEN 'dead' THEN 'dead floor'
END
WHERE r."crowd_vibe" IS NOT NULL;
--> statement-breakpoint
-- 'mid' only exists for backfilled reviews; drop it if nothing used it.
DELETE FROM "tags" t WHERE t."name" = 'mid' AND NOT EXISTS (SELECT 1 FROM "review_tag_links" l WHERE l."tag_id" = t."id");
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "crowd_vibe";
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "crowd_vibe_note";
--> statement-breakpoint
DROP TYPE "public"."crowd_vibe";
