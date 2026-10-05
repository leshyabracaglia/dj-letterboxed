package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// An event series is a recurring event ("Innervisions"); nights (events
// rows) point at one via events.series_id. Unique by lower(name) and slug.

const seriesCols = "id, name, slug, created_by_user_id, created_at"

func scanSeries(row pgx.Row) (*db.EventSeries, error) {
	var s db.EventSeries
	if err := row.Scan(&s.ID, &s.Name, &s.Slug, &s.CreatedByUserID, &s.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

func GetSeriesByID(ctx context.Context, q DBTX, id string) (*db.EventSeries, error) {
	return scanSeries(q.QueryRow(ctx, "SELECT "+seriesCols+" FROM event_series WHERE id = $1", id))
}

func GetSeriesBySlug(ctx context.Context, q DBTX, slug string) (*db.EventSeries, error) {
	return scanSeries(q.QueryRow(ctx, "SELECT "+seriesCols+" FROM event_series WHERE slug = $1", slug))
}

func GetSeriesByName(ctx context.Context, q DBTX, name string) (*db.EventSeries, error) {
	return scanSeries(q.QueryRow(ctx, "SELECT "+seriesCols+" FROM event_series WHERE lower(name) = lower($1)", name))
}

func CreateSeries(ctx context.Context, q DBTX, name, slug, createdByUserID string) (*db.EventSeries, error) {
	return scanSeries(q.QueryRow(ctx, `
		INSERT INTO event_series (name, slug, created_by_user_id)
		VALUES ($1, $2, $3)
		RETURNING `+seriesCols, name, slug, createdByUserID))
}

// SeriesSummary is a series with activity totals across all its nights.
type SeriesSummary struct {
	db.EventSeries
	NightCount  int64    `json:"nightCount"`
	ReviewCount int64    `json:"reviewCount"`
	AvgRating   *float64 `json:"avgRating"`
}

const seriesSummarySelect = `
	SELECT s.id, s.name, s.slug, s.created_by_user_id, s.created_at,
		COUNT(DISTINCT e.id) AS night_count, COUNT(r.id) AS review_count, AVG(r.rating)::float8
	FROM event_series s
	LEFT JOIN events e ON e.series_id = s.id
	LEFT JOIN reviews r ON r.event_id = e.id`

func scanSeriesSummary(row pgx.Row) (*SeriesSummary, error) {
	var s SeriesSummary
	err := row.Scan(&s.ID, &s.Name, &s.Slug, &s.CreatedByUserID, &s.CreatedAt, &s.NightCount, &s.ReviewCount, &s.AvgRating)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

// ListSeries returns series matching query (all of them when it's empty),
// most-reviewed first.
func ListSeries(ctx context.Context, q DBTX, query string, limit int) ([]SeriesSummary, error) {
	rows, err := q.Query(ctx, seriesSummarySelect+`
		WHERE $1 = '' OR s.name ILIKE '%' || $1 || '%'
		GROUP BY s.id
		ORDER BY review_count DESC, night_count DESC, s.name
		LIMIT $2`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SeriesSummary
	for rows.Next() {
		s, err := scanSeriesSummary(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func GetSeriesSummaryBySlug(ctx context.Context, q DBTX, slug string) (*SeriesSummary, error) {
	return scanSeriesSummary(q.QueryRow(ctx, seriesSummarySelect+`
		WHERE s.slug = $1
		GROUP BY s.id`, slug))
}

// SeriesNight is one night of a series with its review totals.
type SeriesNight struct {
	Event       db.Event `json:"event"`
	ReviewCount int64    `json:"reviewCount"`
	AvgRating   *float64 `json:"avgRating"`
}

// ListSeriesNights returns a series' nights, most recent first.
func ListSeriesNights(ctx context.Context, q DBTX, seriesID string) ([]SeriesNight, error) {
	rows, err := q.Query(ctx, `
		SELECT e.id, e.name, e.series_id, e.venue, e.venue_id, e.city, e.event_date, e.description, e.created_by_user_id, e.created_at,
			COUNT(r.id), AVG(r.rating)::float8
		FROM events e
		LEFT JOIN reviews r ON r.event_id = e.id
		WHERE e.series_id = $1
		GROUP BY e.id
		ORDER BY e.event_date DESC`, seriesID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SeriesNight
	for rows.Next() {
		var n SeriesNight
		e := &n.Event
		if err := rows.Scan(&e.ID, &e.Name, &e.SeriesID, &e.Venue, &e.VenueID, &e.City, &e.EventDate, &e.Description, &e.CreatedByUserID, &e.CreatedAt, &n.ReviewCount, &n.AvgRating); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// SeriesDj is a DJ who has played a series, with how many of its nights.
type SeriesDj struct {
	Dj         db.Dj `json:"dj"`
	NightCount int64 `json:"nightCount"`
}

func ListSeriesDjs(ctx context.Context, q DBTX, seriesID string) ([]SeriesDj, error) {
	rows, err := q.Query(ctx, `
		SELECT d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at,
			COUNT(DISTINCT l.event_id) AS night_count
		FROM event_lineup l
		JOIN events e ON e.id = l.event_id
		JOIN djs d ON d.id = l.dj_id
		WHERE e.series_id = $1
		GROUP BY d.id
		ORDER BY night_count DESC, lower(d.name)`, seriesID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SeriesDj
	for rows.Next() {
		var s SeriesDj
		d := &s.Dj
		if err := rows.Scan(&d.ID, &d.Name, &d.Slug, &d.Bio, &d.Genres, &d.ImageURL, &d.SpotifyID, &d.CreatedByUserID, &d.CreatedAt, &d.UpdatedAt, &s.NightCount); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// SeriesVenue is a venue that has hosted a series, with how many nights.
type SeriesVenue struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	City       *string `json:"city"`
	NightCount int64   `json:"nightCount"`
}

func ListSeriesVenues(ctx context.Context, q DBTX, seriesID string) ([]SeriesVenue, error) {
	rows, err := q.Query(ctx, `
		SELECT v.id, v.name, v.city, COUNT(e.id) AS night_count
		FROM events e
		JOIN venues v ON v.id = e.venue_id
		WHERE e.series_id = $1
		GROUP BY v.id
		ORDER BY night_count DESC, v.name`, seriesID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SeriesVenue
	for rows.Next() {
		var v SeriesVenue
		if err := rows.Scan(&v.ID, &v.Name, &v.City, &v.NightCount); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ListSeriesReviews returns the most recent reviews (night and DJ) across a
// series' nights.
func ListSeriesReviews(ctx context.Context, q DBTX, seriesID string, limit int) ([]db.Review, error) {
	rows, err := q.Query(ctx, "SELECT "+reviewCols+` FROM reviews
		WHERE event_id IN (SELECT id FROM events WHERE series_id = $1)
		ORDER BY seen_at DESC, created_at DESC
		LIMIT $2`, seriesID, limit)
	return collectReviews(rows, err)
}

