package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

var ErrNotFound = errors.New("not found")

func scanUser(row pgx.Row) (*db.User, error) {
	var u db.User
	err := row.Scan(&u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

const userCols = "id, clerk_id, username, display_name, bio, avatar_url, created_at, updated_at"

func GetUserByClerkID(ctx context.Context, q DBTX, clerkID string) (*db.User, error) {
	row := q.QueryRow(ctx, "SELECT "+userCols+" FROM users WHERE clerk_id = $1", clerkID)
	return scanUser(row)
}

func GetUserByID(ctx context.Context, q DBTX, id string) (*db.User, error) {
	row := q.QueryRow(ctx, "SELECT "+userCols+" FROM users WHERE id = $1", id)
	return scanUser(row)
}

func GetUserByUsername(ctx context.Context, q DBTX, username string) (*db.User, error) {
	row := q.QueryRow(ctx, "SELECT "+userCols+" FROM users WHERE username = $1", username)
	return scanUser(row)
}

// CreateUser inserts a new user directly (used by the seed script; the app
// itself only ever creates users via CreateUserFallback or
// UpsertUserFromClerk).
func CreateUser(ctx context.Context, q DBTX, clerkID, username string, displayName, bio *string) (*db.User, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO users (clerk_id, username, display_name, bio)
		VALUES ($1, $2, $3, $4)
		RETURNING `+userCols, clerkID, username, displayName, bio)
	return scanUser(row)
}

// CreateUserFallback lazily provisions a user row for a verified Clerk id
// that hasn't landed via the user.created webhook yet. Race-safe: on a
// concurrent insert losing the ON CONFLICT race, it re-selects.
func CreateUserFallback(ctx context.Context, q DBTX, clerkID, fallbackUsername string) (*db.User, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO users (clerk_id, username)
		VALUES ($1, $2)
		ON CONFLICT (clerk_id) DO NOTHING
		RETURNING `+userCols, clerkID, fallbackUsername)

	u, err := scanUser(row)
	if err == nil {
		return u, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	return GetUserByClerkID(ctx, q, clerkID)
}

// UpsertUserFromClerk is used by the Clerk webhook handler for
// user.created/user.updated events. Matches api/webhooks/clerk.ts exactly:
// username is only set on insert, never overwritten on an update conflict
// (a user may have since changed their app-side username).
func UpsertUserFromClerk(ctx context.Context, q DBTX, clerkID, username string, displayName, avatarURL *string) (*db.User, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO users (clerk_id, username, display_name, avatar_url)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (clerk_id) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			avatar_url = EXCLUDED.avatar_url,
			updated_at = now()
		RETURNING `+userCols, clerkID, username, displayName, avatarURL)
	return scanUser(row)
}

func DeleteUserByClerkID(ctx context.Context, q DBTX, clerkID string) error {
	_, err := q.Exec(ctx, "DELETE FROM users WHERE clerk_id = $1", clerkID)
	return err
}

func SearchUsers(ctx context.Context, q DBTX, query string) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+userCols+` FROM users
		WHERE username ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%'
		LIMIT 20`, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []db.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

// GetUsersByIDs batch-fetches users for hydrating relations, keyed by id.
func GetUsersByIDs(ctx context.Context, q DBTX, ids []string) (map[string]db.User, error) {
	out := make(map[string]db.User, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, "SELECT "+userCols+" FROM users WHERE id = ANY($1)", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out[u.ID] = *u
	}
	return out, rows.Err()
}

func UpdateUserProfile(ctx context.Context, q DBTX, id string, displayName, bio, avatarURL *string) (*db.User, error) {
	row := q.QueryRow(ctx, `
		UPDATE users SET
			display_name = COALESCE($2, display_name),
			bio = COALESCE($3, bio),
			avatar_url = COALESCE($4, avatar_url),
			updated_at = now()
		WHERE id = $1
		RETURNING `+userCols, id, displayName, bio, avatarURL)
	return scanUser(row)
}

type LeaderboardEntry struct {
	User     db.User `json:"user"`
	LogCount int64   `json:"logCount"`
}

// GetLeaderboard scopes to the caller and everyone they follow.
func GetLeaderboard(ctx context.Context, q DBTX, userIDs []string) ([]LeaderboardEntry, error) {
	rows, err := q.Query(ctx, `
		SELECT u.id, u.clerk_id, u.username, u.display_name, u.bio, u.avatar_url, u.created_at, u.updated_at,
			COUNT(r.id) AS log_count
		FROM users u
		LEFT JOIN reviews r ON r.user_id = u.id
		WHERE u.id = ANY($1)
		GROUP BY u.id
		ORDER BY log_count DESC`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []LeaderboardEntry
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.User.ID, &e.User.ClerkID, &e.User.Username, &e.User.DisplayName, &e.User.Bio, &e.User.AvatarURL, &e.User.CreatedAt, &e.User.UpdatedAt, &e.LogCount); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
