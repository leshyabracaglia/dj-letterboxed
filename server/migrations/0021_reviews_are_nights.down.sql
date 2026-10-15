-- Back to logs with a lead review each. Every review becomes a log (with the
-- same id) led by itself as the night review, and each rated lineup row
-- becomes a DJ review of its own. Lossy: a night that 0021's up found
-- unrated stays an unrated night review rather than being led by a DJ's.

ALTER TABLE review_lineup DROP CONSTRAINT review_lineup_review_id_fkey;

CREATE TABLE logs (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL,
	event_id uuid,
	venue varchar(160),
	venue_id uuid,
	city varchar(120),
	seen_at timestamp with time zone NOT NULL,
	is_day boolean DEFAULT false NOT NULL,
	is_night boolean DEFAULT true NOT NULL,
	created_at timestamp with time zone DEFAULT now() NOT NULL,
	lead_review_id uuid REFERENCES reviews(id) ON DELETE SET NULL,
	CONSTRAINT logs_day_or_night_check CHECK (is_day OR is_night)
);

INSERT INTO logs (id, user_id, event_id, venue, venue_id, city, seen_at, is_day, is_night, created_at, lead_review_id)
SELECT id, user_id, event_id, venue, venue_id, city, seen_at, is_day, is_night, created_at, id
FROM reviews;

ALTER TABLE reviews ADD COLUMN log_id uuid;
ALTER TABLE reviews ADD COLUMN dj_id uuid;
UPDATE reviews SET log_id = id;

INSERT INTO reviews (user_id, log_id, dj_id, rating, review_text, seen_at, created_at)
SELECT l.user_id, l.id, rl.dj_id, rl.rating, rl.review_text, l.seen_at, l.created_at
FROM review_lineup rl
JOIN logs l ON l.id = rl.review_id
WHERE rl.rating IS NOT NULL;

ALTER TABLE review_lineup DROP CONSTRAINT review_lineup_rating_range;
ALTER TABLE review_lineup DROP COLUMN rating;
ALTER TABLE review_lineup DROP COLUMN review_text;
ALTER TABLE review_lineup RENAME TO log_lineup;
ALTER TABLE log_lineup RENAME COLUMN review_id TO log_id;
ALTER TABLE log_lineup RENAME CONSTRAINT review_lineup_pkey TO log_lineup_log_id_dj_id_pk;
ALTER TABLE log_lineup RENAME CONSTRAINT review_lineup_dj_id_fkey TO log_lineup_dj_id_djs_id_fk;
ALTER INDEX review_lineup_dj_id_idx RENAME TO log_lineup_dj_id_idx;

DROP INDEX reviews_user_id_idx;
DROP INDEX reviews_event_id_idx;
DROP INDEX reviews_venue_id_idx;
ALTER TABLE reviews DROP CONSTRAINT reviews_day_or_night_check;
ALTER TABLE reviews DROP COLUMN event_id;
ALTER TABLE reviews DROP COLUMN venue;
ALTER TABLE reviews DROP COLUMN venue_id;
ALTER TABLE reviews DROP COLUMN city;
ALTER TABLE reviews DROP COLUMN is_day;
ALTER TABLE reviews DROP COLUMN is_night;
ALTER TABLE reviews ALTER COLUMN log_id SET NOT NULL;

ALTER TABLE logs ADD CONSTRAINT logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE logs ADD CONSTRAINT logs_event_id_events_id_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE logs ADD CONSTRAINT logs_venue_id_venues_id_fk FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;
ALTER TABLE log_lineup ADD CONSTRAINT log_lineup_log_id_logs_id_fk FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD CONSTRAINT reviews_log_id_logs_id_fk FOREIGN KEY (log_id) REFERENCES logs(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD CONSTRAINT reviews_dj_id_djs_id_fk FOREIGN KEY (dj_id) REFERENCES djs(id) ON DELETE CASCADE;

CREATE INDEX logs_user_id_idx ON logs (user_id);
CREATE INDEX logs_event_id_idx ON logs (event_id);
CREATE INDEX logs_venue_id_idx ON logs (venue_id);
CREATE INDEX reviews_log_id_idx ON reviews (log_id);
CREATE UNIQUE INDEX logs_lead_review_id_idx ON logs (lead_review_id);
