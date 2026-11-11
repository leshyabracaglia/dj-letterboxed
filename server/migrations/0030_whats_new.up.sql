-- The newest "What's new" sheet (components/WhatsNewSheet.tsx,
-- WHATS_NEW_VERSION) the user has closed, so it shows once per account on
-- every device. Accounts that exist now haven't seen version 1; accounts
-- made from here on start at it, since they never saw what it describes
-- changing. A later version bumps the default in its own migration.
ALTER TABLE users ADD COLUMN whats_new_seen integer NOT NULL DEFAULT 0;
ALTER TABLE users ALTER COLUMN whats_new_seen SET DEFAULT 1;
