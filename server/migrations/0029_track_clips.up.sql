-- A short recording (at most 15 seconds) of an unidentified track, so
-- people who weren't there can listen and help name it. One per track,
-- added by the night's poster. It's only ever streamed by the app, never
-- offered as a download, and it's deleted once the ID is accepted (or the
-- track or night goes). Clips are small enough to keep in Postgres.
CREATE TABLE "track_clips" (
	"track_id" uuid PRIMARY KEY REFERENCES "review_tracks" ("id") ON DELETE CASCADE,
	"content_type" text NOT NULL,
	"audio" bytea NOT NULL,
	"duration_ms" integer NOT NULL CHECK ("duration_ms" BETWEEN 1 AND 15500),
	"created_at" timestamptz NOT NULL DEFAULT now()
);
