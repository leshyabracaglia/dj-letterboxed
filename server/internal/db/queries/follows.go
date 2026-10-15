package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"beatboxd/server/internal/db"
)

func IsFollowing(ctx context.Context, q DBTX, followerID, followingID string) (bool, error) {
	var exists int
	err := q.QueryRow(ctx, "SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1", followerID, followingID).Scan(&exists)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Follow reports whether this was a new follow (false if already following),
// or ErrNotFound if there's no user followingID.
func Follow(ctx context.Context, q DBTX, followerID, followingID string) (bool, error) {
	tag, err := q.Exec(ctx, `
		INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, followerID, followingID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == foreignKeyViolationCode {
		return false, ErrNotFound
	}
	return tag.RowsAffected() > 0, err
}

func Unfollow(ctx context.Context, q DBTX, followerID, followingID string) error {
	_, err := q.Exec(ctx, "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", followerID, followingID)
	return err
}

// GetFollowingIDs returns the ids of users that userID follows.
func GetFollowingIDs(ctx context.Context, q DBTX, userID string) ([]string, error) {
	rows, err := q.Query(ctx, "SELECT following_id FROM follows WHERE follower_id = $1", userID)
	return collect(rows, err, pgx.RowTo[string])
}

const qualifiedUserCols = "u.id, u.clerk_id, u.username, u.display_name, u.bio, u.avatar_url, u.created_at, u.updated_at"

// GetFollowers returns the users who follow userID.
func GetFollowers(ctx context.Context, q DBTX, userID string) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedUserCols+` FROM follows f
		JOIN users u ON u.id = f.follower_id
		WHERE f.following_id = $1`, userID)
	return scanUserRows(rows, err)
}

// GetFollowing returns the users userID follows.
func GetFollowing(ctx context.Context, q DBTX, userID string) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedUserCols+` FROM follows f
		JOIN users u ON u.id = f.following_id
		WHERE f.follower_id = $1`, userID)
	return scanUserRows(rows, err)
}

func scanUserRows(rows pgx.Rows, err error) ([]db.User, error) {
	return collect(rows, err, rowsOf(scanUser))
}
