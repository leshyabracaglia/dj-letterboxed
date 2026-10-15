-- The in-app list of what's happened on a user's account: follows, likes and
-- comments on their reviews, and being tagged in someone else's night out.
-- The same events send a push (server/internal/httpapi/notify.go).
-- review_id/comment_id cascade, so a notification goes when what it's about
-- does.
CREATE TABLE notifications (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	type text NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'tag')),
	review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
	comment_id uuid REFERENCES review_comments(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	CHECK (user_id <> actor_id),
	CHECK ((type = 'follow') = (review_id IS NULL)),
	CHECK ((type = 'comment') = (comment_id IS NOT NULL))
);
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
-- One per follower, and one per liker or tagger per review, so unfollowing
-- and refollowing (or unliking and reliking, or untagging and retagging)
-- doesn't notify twice.
CREATE UNIQUE INDEX notifications_follow_uniq ON notifications (user_id, actor_id) WHERE type = 'follow';
CREATE UNIQUE INDEX notifications_review_uniq ON notifications (user_id, actor_id, type, review_id) WHERE type IN ('like', 'tag');

-- Notifications newer than this are unread; opening the list moves it up.
ALTER TABLE users ADD COLUMN notifications_seen_at timestamptz NOT NULL DEFAULT now();
