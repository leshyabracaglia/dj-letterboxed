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

func SearchDjs(ctx context.Context, q DBTX, query string) ([]db.Dj, error) {
	rows, err := q.Query(ctx, "SELECT "+djCols+" FROM djs WHERE name ILIKE '%' || $1 || '%' LIMIT 20", query)
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
	AvgRating *float64 `json:"avgRating"`
	LogCount  int64    `json:"logCount"`
}

func GetDjAggregate(ctx context.Context, q DBTX, djID string) (*DjAggregate, error) {
	var agg DjAggregate
	err := q.QueryRow(ctx, `
		SELECT AVG(rating_half_stars)::float8, COUNT(*)
		FROM reviews WHERE dj_id = $1`, djID).Scan(&agg.AvgRating, &agg.LogCount)
	if err != nil {
		return nil, err
	}
	return &agg, nil
}
