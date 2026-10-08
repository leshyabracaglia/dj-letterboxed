package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// An event is a named party ("Innervisions NY"); logs point at one via
// logs.event_id. Unique by lower(name) and slug.

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
	out := make(map[string]db.Event, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, "SELECT "+eventCols+" FROM events WHERE id = ANY($1)", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		e, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		out[e.ID] = *e
	}
	return out, rows.Err()
}

// EventSummary is an event with activity totals across every log of it.
type EventSummary struct {
	db.Event
	LogCount    int64    `json:"logCount"`
	ReviewCount int64    `json:"reviewCount"`
	AvgRating   *float64 `json:"avgRating"`
}

const eventSummarySelect = `
	SELECT e.id, e.name, e.slug, e.created_by_user_id, e.created_at,
		COUNT(DISTINCT l.id) AS log_count, COUNT(r.id) AS review_count, AVG(r.rating)::float8
	FROM events e
	LEFT JOIN logs l ON l.event_id = e.id
	LEFT JOIN reviews r ON r.log_id = l.id`

func scanEventSummary(row pgx.Row) (*EventSummary, error) {
	var s EventSummary
	err := row.Scan(&s.ID, &s.Name, &s.Slug, &s.CreatedByUserID, &s.CreatedAt, &s.LogCount, &s.ReviewCount, &s.AvgRating)
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
		ORDER BY review_count DESC, log_count DESC, e.name
		LIMIT $2`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []EventSummary
	for rows.Next() {
		s, err := scanEventSummary(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func GetEventSummaryBySlug(ctx context.Context, q DBTX, slug string) (*EventSummary, error) {
	return scanEventSummary(q.QueryRow(ctx, eventSummarySelect+`
		WHERE e.slug = $1
		GROUP BY e.id`, slug))
}

// EventDj is a DJ people saw at an event, with how many logs list them.
type EventDj struct {
	Dj       db.Dj `json:"dj"`
	LogCount int64 `json:"logCount"`
}

func ListEventDjs(ctx context.Context, q DBTX, eventID string) ([]EventDj, error) {
	rows, err := q.Query(ctx, `
		SELECT d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at,
			COUNT(DISTINCT ll.log_id) AS log_count
		FROM log_lineup ll
		JOIN logs l ON l.id = ll.log_id
		JOIN djs d ON d.id = ll.dj_id
		WHERE l.event_id = $1
		GROUP BY d.id
		ORDER BY log_count DESC, lower(d.name)`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []EventDj
	for rows.Next() {
		var s EventDj
		d := &s.Dj
		if err := rows.Scan(&d.ID, &d.Name, &d.Slug, &d.Bio, &d.Genres, &d.ImageURL, &d.SpotifyID, &d.CreatedByUserID, &d.CreatedAt, &d.UpdatedAt, &s.LogCount); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// EventVenue is a venue an event has been logged at, with how many logs.
type EventVenue struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	City     *string `json:"city"`
	LogCount int64   `json:"logCount"`
}

func ListEventVenues(ctx context.Context, q DBTX, eventID string) ([]EventVenue, error) {
	rows, err := q.Query(ctx, `
		SELECT v.id, v.name, v.city, COUNT(l.id) AS log_count
		FROM logs l
		JOIN venues v ON v.id = l.venue_id
		WHERE l.event_id = $1
		GROUP BY v.id
		ORDER BY log_count DESC, v.name`, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []EventVenue
	for rows.Next() {
		var v EventVenue
		if err := rows.Scan(&v.ID, &v.Name, &v.City, &v.LogCount); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ListEventReviews returns the most recent reviews (night and DJ) across
// every log of an event.
func ListEventReviews(ctx context.Context, q DBTX, eventID string, limit int) ([]db.Review, error) {
	rows, err := q.Query(ctx, "SELECT "+reviewCols+` FROM reviews
		WHERE log_id IN (SELECT id FROM logs WHERE event_id = $1)
		ORDER BY seen_at DESC, created_at DESC
		LIMIT $2`, eventID, limit)
	return collectReviews(rows, err)
}
