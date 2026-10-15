package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// ProfileCounts are the numbers on a user's profile header.
type ProfileCounts struct {
	// Nights is how many nights out (reviews) they've logged.
	Nights    int64
	Followers int64
	Following int64
}

func GetProfileCounts(ctx context.Context, q DBTX, userID string) (*ProfileCounts, error) {
	var c ProfileCounts
	err := q.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM reviews WHERE user_id = $1),
			(SELECT COUNT(*) FROM follows WHERE following_id = $1),
			(SELECT COUNT(*) FROM follows WHERE follower_id = $1)`, userID).
		Scan(&c.Nights, &c.Followers, &c.Following)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

type UserTotals struct {
	Nights    int64
	UniqueDjs int64
}

func GetUserTotals(ctx context.Context, q DBTX, userID string) (*UserTotals, error) {
	var t UserTotals
	// DJs seen are everyone on their nights' lineups, rated or not.
	err := q.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM reviews WHERE user_id = $1),
			(SELECT COUNT(DISTINCT rl.dj_id) FROM reviews r JOIN review_lineup rl ON rl.review_id = r.id WHERE r.user_id = $1)`,
		userID).Scan(&t.Nights, &t.UniqueDjs)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

type TopDj struct {
	Dj        db.Dj `json:"dj"`
	TimesSeen int64 `json:"timesSeen"`
}

// GetTopDjsForUser returns the 3 DJs userID has seen the most (on the lineup
// of their nights, rated or not), like GetRecentDjsForUser.
func GetTopDjsForUser(ctx context.Context, q DBTX, userID string) ([]TopDj, error) {
	rows, err := q.Query(ctx, `
		SELECT d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at, COUNT(*) AS times_seen
		FROM reviews r
		JOIN review_lineup rl ON rl.review_id = r.id
		JOIN djs d ON d.id = rl.dj_id
		WHERE r.user_id = $1
		GROUP BY d.id
		ORDER BY times_seen DESC, MAX(r.seen_at) DESC, d.name
		LIMIT 3`, userID)
	return collect(rows, err, func(row pgx.CollectableRow) (TopDj, error) {
		var t TopDj
		err := row.Scan(&t.Dj.ID, &t.Dj.Name, &t.Dj.Slug, &t.Dj.Bio, &t.Dj.Genres, &t.Dj.ImageURL, &t.Dj.SpotifyID, &t.Dj.CreatedByUserID, &t.Dj.CreatedAt, &t.Dj.UpdatedAt, &t.TimesSeen)
		return t, err
	})
}

type RecentDj struct {
	Dj         db.Dj     `json:"dj"`
	LastSeenAt time.Time `json:"lastSeenAt"`
}

// GetRecentDjsForUser returns the last 3 DJs userID saw (on the lineup of
// any of their nights, rated or not), most recent night first.
func GetRecentDjsForUser(ctx context.Context, q DBTX, userID string) ([]RecentDj, error) {
	rows, err := q.Query(ctx, `
		SELECT d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at, MAX(r.seen_at) AS last_seen_at
		FROM reviews r
		JOIN review_lineup rl ON rl.review_id = r.id
		JOIN djs d ON d.id = rl.dj_id
		WHERE r.user_id = $1
		GROUP BY d.id
		ORDER BY last_seen_at DESC, MAX(r.created_at) DESC, d.name
		LIMIT 3`, userID)
	return collect(rows, err, func(row pgx.CollectableRow) (RecentDj, error) {
		var t RecentDj
		err := row.Scan(&t.Dj.ID, &t.Dj.Name, &t.Dj.Slug, &t.Dj.Bio, &t.Dj.Genres, &t.Dj.ImageURL, &t.Dj.SpotifyID, &t.Dj.CreatedByUserID, &t.Dj.CreatedAt, &t.Dj.UpdatedAt, &t.LastSeenAt)
		return t, err
	})
}

type TopVenue struct {
	Venue       string `json:"venue"`
	ReviewCount int64  `json:"reviewCount"`
}

func GetTopVenuesForUser(ctx context.Context, q DBTX, userID string) ([]TopVenue, error) {
	rows, err := q.Query(ctx, `
		SELECT venue, COUNT(*) AS review_count
		FROM reviews
		WHERE user_id = $1 AND venue IS NOT NULL
		GROUP BY venue
		ORDER BY review_count DESC
		LIMIT 5`, userID)
	return collect(rows, err, pgx.RowToStructByPos[TopVenue])
}
