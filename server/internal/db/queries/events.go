package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// An event is a named party ("Innervisions NY"); reviews point at one via
// reviews.event_id. Unique by lower(name) and slug.

const eventCols = "id, name, slug, created_by_user_id, created_at"

func scanEvent(row pgx.Row) (*db.Event, error) {
	var e db.Event
	if err := row.Scan(&e.ID, &e.Name, &e.Slug, &e.CreatedByUserID, &e.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

func GetEventByID(ctx context.Context, q DBTX, id string) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, "SELECT "+eventCols+" FROM events WHERE id = $1", id))
}

func GetEventBySlug(ctx context.Context, q DBTX, slug string) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, "SELECT "+eventCols+" FROM events WHERE slug = $1", slug))
}

func GetEventByName(ctx context.Context, q DBTX, name string) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, "SELECT "+eventCols+" FROM events WHERE lower(name) = lower($1)", name))
}

func CreateEvent(ctx context.Context, q DBTX, name, slug, createdByUserID string) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, `
		INSERT INTO events (name, slug, created_by_user_id)
		VALUES ($1, $2, $3)
		RETURNING `+eventCols, name, slug, createdByUserID))
}

// GetEventsByIDs batch-fetches events for hydrating relations, keyed by id.
func GetEventsByIDs(ctx context.Context, q DBTX, ids []string) (map[string]db.Event, error) {
	if len(ids) == 0 {
		return map[string]db.Event{}, nil
	}
	rows, err := q.Query(ctx, "SELECT "+eventCols+" FROM events WHERE id = ANY($1)", ids)
	return collectMap(rows, err, rowsOf(scanEvent), func(e db.Event) string { return e.ID })
}

// EventSummary is an event with how many nights out of it people have
// logged, and their average rating of those nights.
type EventSummary struct {
	db.Event
	ReviewCount int64    `json:"reviewCount"`
	AvgRating   *float64 `json:"avgRating" extensions:"x-nullable"`
}

const eventSummarySelect = `
	SELECT e.id, e.name, e.slug, e.created_by_user_id, e.created_at,
		COUNT(r.id) AS review_count, AVG(r.rating)::float8
	FROM events e
	LEFT JOIN reviews r ON r.event_id = e.id`

func scanEventSummary(row pgx.Row) (*EventSummary, error) {
	var s EventSummary
	err := row.Scan(&s.ID, &s.Name, &s.Slug, &s.CreatedByUserID, &s.CreatedAt, &s.ReviewCount, &s.AvgRating)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &s, nil
}

// ListEvents returns events matching query (all of them when it's empty),
// most-reviewed first.
func ListEvents(ctx context.Context, q DBTX, query string, limit int) ([]EventSummary, error) {
	rows, err := q.Query(ctx, eventSummarySelect+`
		WHERE $1 = '' OR e.name ILIKE '%' || $1 || '%'
		GROUP BY e.id
		ORDER BY review_count DESC, e.name
		LIMIT $2`, query, limit)
	return collect(rows, err, rowsOf(scanEventSummary))
}

func GetEventSummaryBySlug(ctx context.Context, q DBTX, slug string) (*EventSummary, error) {
	return scanEventSummary(q.QueryRow(ctx, eventSummarySelect+`
		WHERE e.slug = $1
		GROUP BY e.id`, slug))
}

// EventDj is a DJ people saw at an event, with how many nights out of it
// list them.
type EventDj struct {
	Dj          db.Dj `json:"dj"`
	ReviewCount int64 `json:"reviewCount"`
}

func ListEventDjs(ctx context.Context, q DBTX, eventID string) ([]EventDj, error) {
	rows, err := q.Query(ctx, `
		SELECT d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at,
			COUNT(*) AS review_count
		FROM review_lineup rl
		JOIN reviews r ON r.id = rl.review_id
		JOIN djs d ON d.id = rl.dj_id
		WHERE r.event_id = $1
		GROUP BY d.id
		ORDER BY review_count DESC, lower(d.name)`, eventID)
	return collect(rows, err, func(row pgx.CollectableRow) (EventDj, error) {
		var s EventDj
		err := row.Scan(&s.Dj.ID, &s.Dj.Name, &s.Dj.Slug, &s.Dj.Bio, &s.Dj.Genres, &s.Dj.ImageURL, &s.Dj.SpotifyID, &s.Dj.CreatedByUserID, &s.Dj.CreatedAt, &s.Dj.UpdatedAt, &s.ReviewCount)
		return s, err
	})
}

// EventVenue is a venue an event has been logged at, with how many nights.
type EventVenue struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	City        *string `json:"city" extensions:"x-nullable"`
	ReviewCount int64   `json:"reviewCount"`
}

func ListEventVenues(ctx context.Context, q DBTX, eventID string) ([]EventVenue, error) {
	rows, err := q.Query(ctx, `
		SELECT v.id, v.name, v.city, COUNT(r.id) AS review_count
		FROM reviews r
		JOIN venues v ON v.id = r.venue_id
		WHERE r.event_id = $1
		GROUP BY v.id
		ORDER BY review_count DESC, v.name`, eventID)
	return collect(rows, err, pgx.RowToStructByPos[EventVenue])
}
