-- A night out now shows as one post: its lead review (the night review, or
-- without one its first DJ review, the same order as queries.leadReviewCond)
-- stands for the whole log and holds its likes and comments. Move any that
-- landed on the log's other reviews onto the lead.
CREATE TEMP TABLE lead_reviews AS
SELECT r.id AS review_id, l.lead_id
FROM reviews r
JOIN (
	SELECT DISTINCT ON (log_id) log_id, id AS lead_id
	FROM reviews
	ORDER BY log_id, dj_id IS NOT NULL, created_at, id
) l ON l.log_id = r.log_id
WHERE r.id <> l.lead_id;

INSERT INTO review_likes (review_id, user_id, created_at)
SELECT lr.lead_id, rl.user_id, MIN(rl.created_at)
FROM review_likes rl
JOIN lead_reviews lr ON lr.review_id = rl.review_id
GROUP BY lr.lead_id, rl.user_id
ON CONFLICT DO NOTHING;

DELETE FROM review_likes rl
USING lead_reviews lr
WHERE rl.review_id = lr.review_id;

UPDATE review_comments rc
SET review_id = lr.lead_id
FROM lead_reviews lr
WHERE rc.review_id = lr.review_id;

DROP TABLE lead_reviews;
