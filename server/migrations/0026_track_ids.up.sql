-- ID requests: an unidentified track (no title) on someone's night can get
-- suggestions from others who were there or know it. The night's owner
-- accepts one, which fills in the track and credits whoever named it
-- (identified_by_user_id).
ALTER TABLE "review_tracks" ADD COLUMN "identified_by_user_id" uuid REFERENCES "users" ("id") ON DELETE SET NULL;

CREATE TABLE "track_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"track_id" uuid NOT NULL REFERENCES "review_tracks" ("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
	"source" text NOT NULL CHECK ("source" IN ('spotify', 'soundcloud', 'apple', 'shazam', 'manual')),
	"external_id" text,
	"url" text,
	"title" text NOT NULL,
	"artist" text,
	"artwork_url" text,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "track_suggestions_external_needs_id" CHECK (("source" = 'manual') = ("external_id" IS NULL))
);
CREATE INDEX "track_suggestions_track_id_idx" ON "track_suggestions" ("track_id", "created_at");
-- Suggesting the same track for the same ID twice is a no-op.
CREATE UNIQUE INDEX "track_suggestions_once" ON "track_suggestions" ("track_id", "user_id", lower("title"), lower(coalesce("artist", '')));

-- Someone suggested what a track on your night was; someone accepted the
-- one you suggested.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check"
	CHECK ("type" IN ('follow', 'like', 'comment', 'tag', 'id_suggested', 'id_accepted'));
