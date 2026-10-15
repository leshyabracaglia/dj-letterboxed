-- last_active_at is when the user last used the app (any signed-in request,
-- recorded at most every few minutes; see Auth.touch in
-- server/internal/httpapi/middleware.go). reengaged_at is when they were last
-- sent a "people you follow logged nights" push for being away; see
-- server/internal/httpapi/reengage.go.
ALTER TABLE users ADD COLUMN last_active_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN reengaged_at timestamptz;
CREATE INDEX users_last_active_at_idx ON users (last_active_at);
