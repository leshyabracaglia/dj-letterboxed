-- Tracks someone highlights on their night: one a DJ played (dj_id, on the
-- review's lineup) or one from the night they couldn't pin to a DJ (null).
-- A track is found on a music service (source + external_id, plus its link
-- and artwork) or typed in by hand ('manual'); an unidentified one ("ID -
-- ID") has no title, just a note about it.
CREATE TABLE "review_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"review_id" uuid NOT NULL REFERENCES "reviews" ("id") ON DELETE CASCADE,
	"dj_id" uuid,
	"position" smallint NOT NULL,
	"source" text NOT NULL CHECK ("source" IN ('spotify', 'soundcloud', 'apple', 'shazam', 'manual')),
	"external_id" text,
	"url" text,
	"title" text,
	"artist" text,
	"artwork_url" text,
	"note" text,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "review_tracks_lineup_fk" FOREIGN KEY ("review_id", "dj_id")
		REFERENCES "review_lineup" ("review_id", "dj_id") ON DELETE CASCADE,
	CONSTRAINT "review_tracks_has_something" CHECK ("title" IS NOT NULL OR "note" IS NOT NULL),
	CONSTRAINT "review_tracks_external_needs_id" CHECK (("source" = 'manual') = ("external_id" IS NULL))
);

CREATE INDEX "review_tracks_review_id_idx" ON "review_tracks" ("review_id", "position");
CREATE INDEX "review_tracks_dj_id_idx" ON "review_tracks" ("dj_id") WHERE "dj_id" IS NOT NULL;
