-- Moderation, as the App Store requires of apps with user posts: blocking a
-- user hides each of you from the other (reviews, comments) and stops follows,
-- likes and comments between you; reports flag a review, comment or user for
-- review by hand.
CREATE TABLE blocks (
	blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (blocker_id, blocked_id),
	CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked_id_idx ON blocks (blocked_id);

-- content keeps the reported text, so a report still reads after its review
-- or comment is deleted.
CREATE TABLE reports (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
	reported_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	review_id uuid REFERENCES reviews(id) ON DELETE SET NULL,
	comment_id uuid REFERENCES review_comments(id) ON DELETE SET NULL,
	reason text NOT NULL,
	content text,
	resolved_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_unresolved_idx ON reports (created_at) WHERE resolved_at IS NULL;
