-- Whether the user gets the re-engagement push ("people you follow logged
-- nights" after 48h away; server/internal/httpapi/reengage.go). On unless
-- they turn it off in Settings, as Apple's guideline 4.5.4 asks of pushes
-- that aren't about activity on the user's own account.
ALTER TABLE users ADD COLUMN reengage_push boolean NOT NULL DEFAULT true;
