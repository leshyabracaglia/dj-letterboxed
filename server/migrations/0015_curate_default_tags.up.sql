-- The curated default tags the log form offers. Tags that are merged into
-- one of them keep their reviews under the new name; other old defaults
-- stay on the reviews that used them but are no longer offered, and are
-- deleted if nothing used them.

-- Merge: old name -> kept name.
CREATE TEMP TABLE tag_merges (old_name text, new_name text);
INSERT INTO tag_merges VALUES
	('dancey', 'groovy'),
	('half empty', 'dead floor'),
	('relaxed', 'chill');

INSERT INTO tags (name, is_default)
SELECT DISTINCT new_name, true FROM tag_merges
ON CONFLICT (name) DO NOTHING;

INSERT INTO review_tag_links (review_id, tag_id, created_at)
SELECT l.review_id, nt.id, l.created_at
FROM review_tag_links l
JOIN tags ot ON ot.id = l.tag_id
JOIN tag_merges m ON m.old_name = ot.name
JOIN tags nt ON nt.name = m.new_name
ON CONFLICT DO NOTHING;

DELETE FROM tags t USING tag_merges m WHERE t.name = m.old_name;

DROP TABLE tag_merges;

-- The offered set.
UPDATE tags SET is_default = false;

INSERT INTO tags (name, is_default) VALUES
	('groovy', true),
	('high energy', true),
	('chill', true),
	('dead floor', true),
	('younger crowd', true),
	('older crowd', true),
	('phones out', true),
	('friendly', true),
	('phone-free', true),
	('packed', true),
	('intimate', true),
	('great sound', true),
	('bad sound', true),
	('cool lighting', true),
	('cool design', true),
	('long queue', true),
	('no security', true),
	('hard security', true),
	('drunk crowd', true),
	('chatty crowd', true),
	('sweaty', true)
ON CONFLICT (name) DO UPDATE SET is_default = true;

-- Retired defaults nobody used.
DELETE FROM tags t
WHERE NOT t.is_default
	AND t.created_by_user_id IS NULL
	AND NOT EXISTS (SELECT 1 FROM review_tag_links l WHERE l.tag_id = t.id);
