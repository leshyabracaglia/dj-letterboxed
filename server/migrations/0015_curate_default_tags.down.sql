-- Restores the previous default set. Merged tags aren't split back apart:
-- reviews tagged dancey/half empty/relaxed keep groovy/dead floor/chill.
UPDATE tags SET is_default = false;

INSERT INTO tags (name, is_default) VALUES
	('older crowd', true),
	('younger crowd', true),
	('drunk crowd', true),
	('relaxed', true),
	('overwhelming', true),
	('good vibes', true),
	('packed', true),
	('half empty', true),
	('dead floor', true),
	('dancey', true),
	('chatty crowd', true),
	('phones out', true),
	('friendly', true),
	('sweaty', true),
	('intimate', true),
	('great sound', true),
	('bad sound', true),
	('long queue', true),
	('groovy', true)
ON CONFLICT (name) DO UPDATE SET is_default = true;

DELETE FROM tags t
WHERE NOT t.is_default
	AND t.created_by_user_id IS NULL
	AND NOT EXISTS (SELECT 1 FROM review_tag_links l WHERE l.tag_id = t.id);
