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
	// TimesSeen is how many nights logged have them on the lineup.
	TimesSeen int64 `json:"timesSeen"`
	// ReviewCount is how many of those say something about their set.
	ReviewCount int64 `json:"reviewCount"`
}

// GetDjAggregate counts the nights djID was seen on and the sets of theirs
// people wrote about.
func GetDjAggregate(ctx context.Context, q DBTX, djID string) (*DjAggregate, error) {
	var agg DjAggregate
	err := q.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(*) FILTER (WHERE review_text IS NOT NULL)
		FROM review_lineup WHERE dj_id = $1`, djID).Scan(&agg.TimesSeen, &agg.ReviewCount)
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

// DjPortrait is how people describe a DJ, from what they've logged: the
// tags on nights with them, where they're seen most, and the most-liked
// thing written about one of their sets.
type DjPortrait struct {
	Descriptors []TagCount     `json:"descriptors"`
	Venues      []DjVenueCount `json:"venues"`
	PullQuote   *DjPullQuote   `json:"pullQuote" extensions:"x-nullable"`
}

type TagCount struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

type DjVenueCount struct {
	VenueID string `json:"venueId"`
	Name    string `json:"name"`
	Nights  int64  `json:"nights"`
}

type DjPullQuote struct {
	ReviewID string  `json:"reviewId"`
	Text     string  `json:"text"`
	User     db.User `json:"user"`
}

// GetDjPortrait builds djID's portrait from nights they were on the lineup
// of, leaving out anything by excludeUserIDs (who's hidden from the
// caller). Tags count once per night; the pull quote is the set review with
// the most likes, preferring one of a readable length, then the newest.
func GetDjPortrait(ctx context.Context, q DBTX, djID string, excludeUserIDs []string) (*DjPortrait, error) {
	if excludeUserIDs == nil {
		excludeUserIDs = []string{}
	}
	var p DjPortrait
	rows, err := q.Query(ctx, `
		SELECT t.name, COUNT(*) AS n
		FROM review_lineup rl
		JOIN reviews r ON r.id = rl.review_id
		JOIN review_tag_links l ON l.review_id = r.id
		JOIN tags t ON t.id = l.tag_id
		WHERE rl.dj_id = $1 AND NOT (r.user_id = ANY($2))
		GROUP BY t.name
		ORDER BY n DESC, t.name
		LIMIT 6`, djID, excludeUserIDs)
	if p.Descriptors, err = collect(rows, err, pgx.RowToStructByPos[TagCount]); err != nil {
		return nil, err
	}
	rows, err = q.Query(ctx, `
		SELECT v.id, v.name, COUNT(*) AS n
		FROM review_lineup rl
		JOIN reviews r ON r.id = rl.review_id
		JOIN venues v ON v.id = r.venue_id
		WHERE rl.dj_id = $1 AND NOT (r.user_id = ANY($2))
		GROUP BY v.id
		ORDER BY n DESC, v.name
		LIMIT 3`, djID, excludeUserIDs)
	if p.Venues, err = collect(rows, err, pgx.RowToStructByPos[DjVenueCount]); err != nil {
		return nil, err
	}
	var quote DjPullQuote
	u := &quote.User
	err = q.QueryRow(ctx, `
		SELECT r.id, rl.review_text, `+qualifiedUserCols+`
		FROM review_lineup rl
		JOIN reviews r ON r.id = rl.review_id
		JOIN users u ON u.id = r.user_id
		WHERE rl.dj_id = $1 AND rl.review_text IS NOT NULL AND NOT (r.user_id = ANY($2))
		ORDER BY (SELECT COUNT(*) FROM review_likes k WHERE k.review_id = r.id) DESC,
			(length(rl.review_text) BETWEEN 40 AND 280) DESC, r.created_at DESC
		LIMIT 1`, djID, excludeUserIDs).
		Scan(&quote.ReviewID, &quote.Text, &u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt)
	switch {
	case err == nil:
		p.PullQuote = &quote
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}
	return &p, nil
}
