-- A check-in is someone confirming, by their device's location, that they're
-- at a venue right now. A log of that venue on that day (or the night running
-- into the next morning) by the same person shows as verified; see
-- logVerifiedExpr in server/internal/db/queries/logs.go. The coordinates
-- themselves aren't kept, only how far from the venue they were.
CREATE TABLE check_ins (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
	distance_m integer NOT NULL,
	accuracy_m integer,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX check_ins_user_venue_created_idx ON check_ins (user_id, venue_id, created_at);
