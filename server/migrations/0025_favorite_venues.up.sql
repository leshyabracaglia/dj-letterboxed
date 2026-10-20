-- The clubs someone pins to their profile, #1 first: at most 3, each one
-- they've been to (logged a night at or checked in at; the handler checks).
CREATE TABLE "favorite_venues" (
	"user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
	"venue_id" uuid NOT NULL REFERENCES "venues" ("id") ON DELETE CASCADE,
	"position" smallint NOT NULL CHECK ("position" BETWEEN 1 AND 3),
	PRIMARY KEY ("user_id", "position"),
	UNIQUE ("user_id", "venue_id")
);
