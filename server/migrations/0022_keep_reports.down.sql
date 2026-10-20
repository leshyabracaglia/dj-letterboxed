-- Reports against deleted accounts can't point at a user again, so they go.
DELETE FROM reports WHERE reported_user_id IS NULL;
ALTER TABLE reports DROP CONSTRAINT reports_reported_user_id_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_reported_user_id_fkey
	FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE reports ALTER COLUMN reported_user_id SET NOT NULL;

ALTER TABLE reports DROP COLUMN reported_username;
