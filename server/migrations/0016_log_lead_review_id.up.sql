-- A log's lead review - the one that stands for its night out as a post and
-- holds its likes and comments - is stored on the log instead of recomputed
-- by every query. POST /logs makes it the night review. Existing logs keep the
-- lead 0014 moved their likes and comments onto (the night review, or without
-- one the first DJ review by created_at, then id).
ALTER TABLE logs ADD COLUMN lead_review_id uuid REFERENCES reviews(id) ON DELETE SET NULL;

UPDATE logs l
SET lead_review_id = lead.id
FROM (
	SELECT DISTINCT ON (log_id) log_id, id
	FROM reviews
	ORDER BY log_id, dj_id IS NOT NULL, created_at, id
) lead
WHERE lead.log_id = l.id;

CREATE UNIQUE INDEX logs_lead_review_id_idx ON logs (lead_review_id);
