-- Reports outlive the reported user's account: deleting it used to cascade
-- to every report against them, so an abuser could erase the evidence by
-- deleting their account. The report now keeps their username as it was when
-- reported (alongside the reported text already kept in content), and
-- reported_user_id goes null once the account is gone.
ALTER TABLE reports ADD COLUMN reported_username text;
UPDATE reports r SET reported_username = u.username FROM users u WHERE u.id = r.reported_user_id;
ALTER TABLE reports ALTER COLUMN reported_username SET NOT NULL;

ALTER TABLE reports ALTER COLUMN reported_user_id DROP NOT NULL;
ALTER TABLE reports DROP CONSTRAINT reports_reported_user_id_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_reported_user_id_fkey
	FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE SET NULL;
