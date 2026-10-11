package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

const djCols = "id, name, slug, bio, genres, image_url, spotify_id, created_by_user_id, created_at, updated_at"

func scanDj(row pgx.Row) (*db.Dj, error) {
	var d db.Dj
	err := row.Scan(&d.ID, &d.Name, &d.Slug, &d.Bio, &d.Genres, &d.ImageURL, &d.SpotifyID, &d.CreatedByUserID, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &d, nil
}

// SearchDjs matches DJs by name, most-reviewed first; an empty query returns
// the most-reviewed DJs overall.
func SearchDjs(ctx context.Context, q DBTX, query string, limit int) ([]db.Dj, error) {
	rows, err := q.Query(ctx, "SELECT "+djCols+` FROM djs
		WHERE $1 = '' OR name ILIKE '%' || $1 || '%'
		ORDER BY (SELECT COUNT(*) FROM reviews r WHERE r.dj_id = djs.id) DESC, lower(name)
		LIMIT $2`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []db.Dj
	for rows.Next() {
		d, err := scanDj(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

func GetDjBySlug(ctx context.Context, q DBTX, slug string) (*db.Dj, error) {
	return scanDj(q.QueryRow(ctx, "SELECT "+djCols+" FROM djs WHERE slug = $1", slug))
}

func GetDjByID(ctx context.Context, q DBTX, id string) (*db.Dj, error) {
	return scanDj(q.QueryRow(ctx, "SELECT "+djCols+" FROM djs WHERE id = $1", id))
}

func GetDjBySpotifyID(ctx context.Context, q DBTX, spotifyID string) (*db.Dj, error) {
	return scanDj(q.QueryRow(ctx, "SELECT "+djCols+" FROM djs WHERE spotify_id = $1", spotifyID))
}

func CreateDj(ctx context.Context, q DBTX, name, slug string, bio *string, genres []string, spotifyID, imageURL *string, createdByUserID string) (*db.Dj, error) {
	return scanDj(q.QueryRow(ctx, `
		INSERT INTO djs (name, slug, bio, genres, image_url, spotify_id, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING `+djCols, name, slug, bio, genres, imageURL, spotifyID, createdByUserID))
}

// GetDjsByIDs batch-fetches djs for hydrating relations, keyed by id.
func GetDjsByIDs(ctx context.Context, q DBTX, ids []string) (map[string]db.Dj, error) {
	out := make(map[string]db.Dj, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, "SELECT "+djCols+" FROM djs WHERE id = ANY($1)", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		d, err := scanDj(rows)
		if err != nil {
			return nil, err
		}
		out[d.ID] = *d
	}
	return out, rows.Err()
}

type DjAggregate struct {
	AvgRating   *float64 `json:"avgRating"`
	ReviewCount int64    `json:"reviewCount"`
	// RatingCounts[i] is how many reviews gave i+1 stars.
	RatingCounts []int64 `json:"ratingCounts"`
}

// GetDjAggregate rates djID from reviews of them, plus night reviews of
// nights they were the only DJ on the lineup of (a solo night's rating is
// theirs), unless that log also rated them directly.
func GetDjAggregate(ctx context.Context, q DBTX, djID string) (*DjAggregate, error) {
	var agg DjAggregate
	err := q.QueryRow(ctx, `
		SELECT AVG(rating)::float8, COUNT(*),
			ARRAY[
				COUNT(*) FILTER (WHERE rating = 1),
				COUNT(*) FILTER (WHERE rating = 2),
				COUNT(*) FILTER (WHERE rating = 3),
				COUNT(*) FILTER (WHERE rating = 4),
				COUNT(*) FILTER (WHERE rating = 5)
			]
		FROM reviews
		WHERE dj_id = $1 OR (dj_id IS NULL
			AND log_id IN (SELECT log_id FROM log_lineup GROUP BY log_id HAVING bool_and(dj_id = $1))
			AND NOT EXISTS (SELECT 1 FROM reviews dr WHERE dr.log_id = reviews.log_id AND dr.dj_id = $1))`, djID).Scan(&agg.AvgRating, &agg.ReviewCount, &agg.RatingCounts)
	if err != nil {
		return nil, err
	}
	return &agg, nil
}

// GetDjByName finds a DJ by exact (case-insensitive) name, preferring a
// Spotify-linked one, then the most reviewed.
func GetDjByName(ctx context.Context, q DBTX, name string) (*db.Dj, error) {
	return scanDj(q.QueryRow(ctx, "SELECT "+djCols+` FROM djs
		WHERE lower(name) = lower($1)
		ORDER BY spotify_id IS NULL, (SELECT COUNT(*) FROM reviews r WHERE r.dj_id = djs.id) DESC
		LIMIT 1`, name))
}
