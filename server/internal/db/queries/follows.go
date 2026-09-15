package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

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

func Follow(ctx context.Context, q DBTX, followerID, followingID string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, followerID, followingID)
	return err
}

func Unfollow(ctx context.Context, q DBTX, followerID, followingID string) error {
	_, err := q.Exec(ctx, "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", followerID, followingID)
	return err
}

// GetFollowingIDs returns the ids of users that userID follows.
func GetFollowingIDs(ctx context.Context, q DBTX, userID string) ([]string, error) {
	rows, err := q.Query(ctx, "SELECT following_id FROM follows WHERE follower_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func CountFollowers(ctx context.Context, q DBTX, userID string) (int64, error) {
	var n int64
	err := q.QueryRow(ctx, "SELECT COUNT(*) FROM follows WHERE following_id = $1", userID).Scan(&n)
	return n, err
}

func CountFollowing(ctx context.Context, q DBTX, userID string) (int64, error) {
	var n int64
	err := q.QueryRow(ctx, "SELECT COUNT(*) FROM follows WHERE follower_id = $1", userID).Scan(&n)
	return n, err
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

func scanUserRows(rows interface {
	Next() bool
	Scan(...any) error
	Err() error
	Close()
}, err error) ([]db.User, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []db.User
	for rows.Next() {
		var u db.User
		if err := rows.Scan(&u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
