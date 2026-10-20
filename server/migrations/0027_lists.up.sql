-- Lists people curate ("Best closing sets of 2026"): logged nights, or one
-- DJ's set on a night (dj_id, on that night's lineup), in order, each with
-- an optional note. Anyone's nights can go on anyone's list.
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "lists_user_id_idx" ON "lists" ("user_id", "updated_at" DESC);

CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"list_id" uuid NOT NULL REFERENCES "lists" ("id") ON DELETE CASCADE,
	"review_id" uuid NOT NULL REFERENCES "reviews" ("id") ON DELETE CASCADE,
	"dj_id" uuid,
	"note" text,
	"position" integer NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "list_items_set_fk" FOREIGN KEY ("review_id", "dj_id")
		REFERENCES "review_lineup" ("review_id", "dj_id") ON DELETE CASCADE
);
CREATE INDEX "list_items_list_id_idx" ON "list_items" ("list_id", "position");
CREATE INDEX "list_items_review_id_idx" ON "list_items" ("review_id");
-- A night (or a set) goes on a list once.
CREATE UNIQUE INDEX "list_items_once" ON "list_items" ("list_id", "review_id", coalesce("dj_id", '00000000-0000-0000-0000-000000000000'));
