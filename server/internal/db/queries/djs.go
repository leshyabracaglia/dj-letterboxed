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

// SearchDjs matches DJs by name, most-seen first; an empty query returns
// the most-seen DJs overall.
func SearchDjs(ctx context.Context, q DBTX, query string, limit int) ([]db.Dj, error) {
	rows, err := q.Query(ctx, "SELECT "+djCols+` FROM djs
		WHERE $1 = '' OR name ILIKE '%' || $1 || '%'
		ORDER BY (SELECT COUNT(*) FROM review_lineup rl WHERE rl.dj_id = djs.id) DESC, lower(name)
		LIMIT $2`, query, limit)
	return collect(rows, err, rowsOf(scanDj))
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
	if len(ids) == 0 {
		return map[string]db.Dj{}, nil
	}
	rows, err := q.Query(ctx, "SELECT "+djCols+" FROM djs WHERE id = ANY($1)", ids)
	return collectMap(rows, err, rowsOf(scanDj), func(d db.Dj) string { return d.ID })
}

type DjAggregate struct {
	AvgRating   *float64 `json:"avgRating" extensions:"x-nullable"`
	ReviewCount int64    `json:"reviewCount"`
	// RatingCounts[i] is how many reviews gave i+1 stars.
	RatingCounts []int64 `json:"ratingCounts"`
}

// GetDjAggregate rates djID from their ratings on nights' lineups, plus the
// rating of nights they were the only DJ on the lineup of and weren't rated
// on themselves (a solo night's rating is theirs).
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
		FROM (
			SELECT rating FROM review_lineup WHERE dj_id = $1 AND rating IS NOT NULL
			UNION ALL
			SELECT r.rating FROM reviews r
			JOIN review_lineup rl ON rl.review_id = r.id AND rl.dj_id = $1 AND rl.rating IS NULL
			WHERE r.rating IS NOT NULL
				AND NOT EXISTS (SELECT 1 FROM review_lineup o WHERE o.review_id = r.id AND o.dj_id <> $1)
		) ratings`, djID).Scan(&agg.AvgRating, &agg.ReviewCount, &agg.RatingCounts)
	if err != nil {
		return nil, err
	}
	return &agg, nil
}

// GetDjByName finds a DJ by exact (case-insensitive) name, preferring a
// Spotify-linked one, then the most seen.
func GetDjByName(ctx context.Context, q DBTX, name string) (*db.Dj, error) {
	return scanDj(q.QueryRow(ctx, "SELECT "+djCols+` FROM djs
		WHERE lower(name) = lower($1)
		ORDER BY spotify_id IS NULL, (SELECT COUNT(*) FROM review_lineup rl WHERE rl.dj_id = djs.id) DESC
		LIMIT 1`, name))
}
