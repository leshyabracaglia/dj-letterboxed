-- A review is now one person's night out, and the post: the event, venue,
-- day and day/night move onto it from logs, along with its rating and text,
-- and the DJs seen move to review_lineup, each with an optional rating and
-- text of their own (a rated row is a DJ review). logs, lead reviews and
-- night reviews with no DJ all go.
--
-- Each night keeps its log's lead review's id (see 0016), so links, pushes,
-- likes, comments, tagged friends, favorites and notifications already point
-- at it. Anything still on one of a log's other reviews moves onto the lead
-- before those are deleted. A lead that was a DJ's review (a log with no
-- night review) leaves its rating and text with that DJ, so the night itself
-- is unrated: the only nights with a null rating.

-- Every log needs a lead to become its review: 0016 set one on every log
-- with reviews; a log with none gets an unrated one.
UPDATE logs l SET lead_review_id = lead.id
FROM (
	SELECT DISTINCT ON (log_id) log_id, id
	FROM reviews
	ORDER BY log_id, dj_id IS NOT NULL, created_at, id
) lead
WHERE lead.log_id = l.id AND l.lead_review_id IS NULL;

INSERT INTO reviews (user_id, log_id, seen_at, created_at)
SELECT user_id, id, seen_at, created_at FROM logs WHERE lead_review_id IS NULL;

UPDATE logs l SET lead_review_id = r.id
FROM reviews r
WHERE r.log_id = l.id AND l.lead_review_id IS NULL;

CREATE TEMP TABLE review_leads AS
SELECT r.id AS old_id, l.lead_review_id AS lead_id
FROM reviews r
JOIN logs l ON l.id = r.log_id
WHERE r.id <> l.lead_review_id;

-- DJ ratings move onto the lineup.
ALTER TABLE log_lineup ADD COLUMN rating smallint;
ALTER TABLE log_lineup ADD COLUMN review_text text;

INSERT INTO log_lineup (log_id, dj_id)
SELECT DISTINCT log_id, dj_id FROM reviews WHERE dj_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE log_lineup ll SET rating = r.rating, review_text = r.review_text
FROM reviews r
WHERE r.log_id = ll.log_id AND r.dj_id = ll.dj_id;

-- Everything on a log's other reviews moves onto its lead.
INSERT INTO review_likes (review_id, user_id, created_at)
SELECT m.lead_id, rl.user_id, MIN(rl.created_at)
FROM review_likes rl JOIN review_leads m ON m.old_id = rl.review_id
GROUP BY m.lead_id, rl.user_id
ON CONFLICT DO NOTHING;

UPDATE review_comments c SET review_id = m.lead_id
FROM review_leads m WHERE m.old_id = c.review_id;

INSERT INTO review_tags (review_id, tagged_user_id, created_at)
SELECT m.lead_id, t.tagged_user_id, MIN(t.created_at)
FROM review_tags t JOIN review_leads m ON m.old_id = t.review_id
GROUP BY m.lead_id, t.tagged_user_id
ON CONFLICT DO NOTHING;

INSERT INTO review_tag_links (review_id, tag_id, created_at)
SELECT m.lead_id, t.tag_id, MIN(t.created_at)
FROM review_tag_links t JOIN review_leads m ON m.old_id = t.review_id
GROUP BY m.lead_id, t.tag_id
ON CONFLICT DO NOTHING;

-- A favorite of a night's DJ review becomes a favorite of the night, unless
-- the night (or another of its reviews, at a better position) is already one.
DELETE FROM favorite_reviews f
USING review_leads m
WHERE m.old_id = f.review_id AND EXISTS (
	SELECT 1 FROM favorite_reviews o
	WHERE o.user_id = f.user_id AND o.position < f.position
		AND (o.review_id = m.lead_id OR o.review_id IN (SELECT old_id FROM review_leads WHERE lead_id = m.lead_id))
);
DELETE FROM favorite_reviews f
USING review_leads m
WHERE m.old_id = f.review_id
	AND EXISTS (SELECT 1 FROM favorite_reviews o WHERE o.user_id = f.user_id AND o.review_id = m.lead_id);
UPDATE favorite_reviews f SET review_id = m.lead_id
FROM review_leads m WHERE m.old_id = f.review_id;

-- Likes and tags notify once per night (notifications_review_uniq): of any
-- that would now collide, keep the night's own, else the earliest.
DELETE FROM notifications n
USING review_leads m
WHERE m.old_id = n.review_id AND n.type IN ('like', 'tag') AND EXISTS (
	SELECT 1 FROM notifications o
	WHERE o.user_id = n.user_id AND o.actor_id = n.actor_id AND o.type = n.type AND o.id <> n.id
		AND (o.review_id = m.lead_id OR (
			o.review_id IN (SELECT old_id FROM review_leads WHERE lead_id = m.lead_id)
			AND (o.created_at, o.id) < (n.created_at, n.id)
		))
);
UPDATE notifications n SET review_id = m.lead_id
FROM review_leads m WHERE m.old_id = n.review_id;

UPDATE reports p SET review_id = m.lead_id
FROM review_leads m WHERE m.old_id = p.review_id;

-- The night moves onto its review.
ALTER TABLE reviews ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE SET NULL;
-- The venue's display name, denormalized alongside venue_id. Both are null
-- only on nights migrated from reviews that never had one.
ALTER TABLE reviews ADD COLUMN venue varchar(160);
ALTER TABLE reviews ADD COLUMN venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN city varchar(120);
ALTER TABLE reviews ADD COLUMN is_day boolean NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN is_night boolean NOT NULL DEFAULT true;
ALTER TABLE reviews ADD CONSTRAINT reviews_day_or_night_check CHECK (is_day OR is_night);

UPDATE reviews r
SET event_id = l.event_id, venue = l.venue, venue_id = l.venue_id, city = l.city,
	seen_at = l.seen_at, is_day = l.is_day, is_night = l.is_night, created_at = l.created_at
FROM logs l
WHERE l.lead_review_id = r.id;

UPDATE reviews SET rating = NULL, review_text = NULL
WHERE dj_id IS NOT NULL AND id IN (SELECT lead_review_id FROM logs);

-- The lineup moves onto the review.
ALTER TABLE log_lineup ADD COLUMN review_id uuid;
UPDATE log_lineup ll SET review_id = l.lead_review_id FROM logs l WHERE l.id = ll.log_id;

DELETE FROM reviews WHERE id IN (SELECT old_id FROM review_leads);
DROP TABLE review_leads;

ALTER TABLE reviews DROP COLUMN log_id;
ALTER TABLE reviews DROP COLUMN dj_id;

ALTER TABLE log_lineup DROP CONSTRAINT log_lineup_log_id_dj_id_pk;
ALTER TABLE log_lineup DROP COLUMN log_id;
DROP TABLE logs;

ALTER TABLE log_lineup RENAME TO review_lineup;
ALTER TABLE review_lineup ALTER COLUMN review_id SET NOT NULL;
ALTER TABLE review_lineup ADD CONSTRAINT review_lineup_pkey PRIMARY KEY (review_id, dj_id);
ALTER TABLE review_lineup ADD CONSTRAINT review_lineup_review_id_fkey FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE;
ALTER TABLE review_lineup RENAME CONSTRAINT log_lineup_dj_id_djs_id_fk TO review_lineup_dj_id_fkey;
ALTER TABLE review_lineup ADD CONSTRAINT review_lineup_rating_range CHECK (rating >= 1 AND rating <= 5);
ALTER INDEX log_lineup_dj_id_idx RENAME TO review_lineup_dj_id_idx;

CREATE INDEX reviews_user_id_idx ON reviews (user_id);
CREATE INDEX reviews_event_id_idx ON reviews (event_id);
CREATE INDEX reviews_venue_id_idx ON reviews (venue_id);
