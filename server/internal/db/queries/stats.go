package queries

import (
	"context"

	"beatboxd/server/internal/db"
)

func CountReviewsByUser(ctx context.Context, q DBTX, userID string) (int64, error) {
	var n int64
	err := q.QueryRow(ctx, "SELECT COUNT(*) FROM reviews WHERE user_id = $1", userID).Scan(&n)
	return n, err
}

type UserTotals struct {
	TotalLogs int64 `json:"totalLogs"`
	UniqueDjs int64 `json:"uniqueDjs"`
}

func GetUserTotals(ctx context.Context, q DBTX, userID string) (*UserTotals, error) {
	var t UserTotals
	err := q.QueryRow(ctx, "SELECT COUNT(*), COUNT(DISTINCT dj_id) FROM reviews WHERE user_id = $1", userID).Scan(&t.TotalLogs, &t.UniqueDjs)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

type TopDj struct {
	Dj       db.Dj `json:"dj"`
	LogCount int64 `json:"logCount"`
}

func GetTopDjsForUser(ctx context.Context, q DBTX, userID string) ([]TopDj, error) {
	rows, err := q.Query(ctx, `
		SELECT d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at, COUNT(r.id) AS log_count
		FROM reviews r
		JOIN djs d ON d.id = r.dj_id
		WHERE r.user_id = $1
		GROUP BY d.id
		ORDER BY log_count DESC
		LIMIT 5`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TopDj
	for rows.Next() {
		var t TopDj
		if err := rows.Scan(&t.Dj.ID, &t.Dj.Name, &t.Dj.Slug, &t.Dj.Bio, &t.Dj.Genres, &t.Dj.ImageURL, &t.Dj.SpotifyID, &t.Dj.CreatedByUserID, &t.Dj.CreatedAt, &t.Dj.UpdatedAt, &t.LogCount); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

type TopVenue struct {
	Venue    string `json:"venue"`
	LogCount int64  `json:"logCount"`
}

func GetTopVenuesForUser(ctx context.Context, q DBTX, userID string) ([]TopVenue, error) {
	rows, err := q.Query(ctx, `
		SELECT e.venue, COUNT(r.id) AS log_count
		FROM reviews r
		JOIN events e ON e.id = r.event_id
		WHERE r.user_id = $1
		GROUP BY e.venue
		ORDER BY log_count DESC
		LIMIT 5`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TopVenue
	for rows.Next() {
		var t TopVenue
		if err := rows.Scan(&t.Venue, &t.LogCount); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
