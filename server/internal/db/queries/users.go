package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"beatboxd/server/internal/db"
)

var ErrNotFound = errors.New("not found")
var ErrUsernameTaken = errors.New("username taken")

const (
	uniqueViolationCode     = "23505"
	foreignKeyViolationCode = "23503"
)

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
func CreateUser(ctx context.Context, q DBTX, clerkID, username string, displayName, bio, avatarURL *string) (*db.User, error) {
	row := q.QueryRow(ctx, `
		INSERT INTO users (clerk_id, username, display_name, bio, avatar_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+userCols, clerkID, username, displayName, bio, avatarURL)
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
// user.created/user.updated events. The username is only set on insert,
// never overwritten on an update conflict (a user may have since changed
// their app-side username).
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

// SearchUsers matches users by username or display name, most-followed
// first; an empty query returns the most-followed users overall.
func SearchUsers(ctx context.Context, q DBTX, query string, limit int) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+userCols+` FROM users
		WHERE $1 = '' OR username ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%'
		ORDER BY (SELECT COUNT(*) FROM follows f WHERE f.following_id = users.id) DESC, lower(username)
		LIMIT $2`, query, limit)
	return scanUserRows(rows, err)
}

// GetUsersByIDs batch-fetches users for hydrating relations, keyed by id.
func GetUsersByIDs(ctx context.Context, q DBTX, ids []string) (map[string]db.User, error) {
	if len(ids) == 0 {
		return map[string]db.User{}, nil
	}
	rows, err := q.Query(ctx, "SELECT "+userCols+" FROM users WHERE id = ANY($1)", ids)
	return collectMap(rows, err, rowsOf(scanUser), func(u db.User) string { return u.ID })
}

func UpdateUserProfile(ctx context.Context, q DBTX, id string, username, displayName, bio, avatarURL *string) (*db.User, error) {
	row := q.QueryRow(ctx, `
		UPDATE users SET
			username = COALESCE($2, username),
			display_name = COALESCE($3, display_name),
			bio = COALESCE($4, bio),
			avatar_url = COALESCE($5, avatar_url),
			updated_at = now()
		WHERE id = $1
		RETURNING `+userCols, id, username, displayName, bio, avatarURL)
	u, err := scanUser(row)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolationCode {
			return nil, ErrUsernameTaken
		}
		return nil, err
	}
	return u, nil
}
