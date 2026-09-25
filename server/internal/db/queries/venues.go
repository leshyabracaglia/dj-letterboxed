package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// Venues aren't a normalized entity - they're derived from events.venue
// (a plain text column), the same way GetTopVenuesForUser in stats.go
// already aggregates them. A venue is identified by its exact venue-name
// string, matching how CreateEvent dedupes events by exact name+venue+date.

type VenueSummary struct {
	Venue      string  `json:"venue"`
	City       *string `json:"city"`
	EventCount int64   `json:"eventCount"`
}

func SearchVenues(ctx context.Context, q DBTX, query string) ([]VenueSummary, error) {
	rows, err := q.Query(ctx, `
		SELECT venue, (array_agg(city ORDER BY event_date DESC))[1] AS city, COUNT(*) AS event_count
		FROM events
		WHERE venue ILIKE '%' || $1 || '%'
		GROUP BY venue
		ORDER BY event_count DESC
		LIMIT 20`, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []VenueSummary
	for rows.Next() {
		var v VenueSummary
		if err := rows.Scan(&v.Venue, &v.City, &v.EventCount); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// GetVenueSummary returns (nil, nil) - not ErrNotFound - when no event has
// this venue, since a venue name with no matches is an empty listing, not
// a broken reference.
func GetVenueSummary(ctx context.Context, q DBTX, venue string) (*VenueSummary, error) {
	var v VenueSummary
	err := q.QueryRow(ctx, `
		SELECT venue, (array_agg(city ORDER BY event_date DESC))[1] AS city, COUNT(*) AS event_count
		FROM events
		WHERE venue = $1
		GROUP BY venue`, venue).Scan(&v.Venue, &v.City, &v.EventCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func ListEventsByVenue(ctx context.Context, q DBTX, venue string) ([]db.Event, error) {
	rows, err := q.Query(ctx, "SELECT "+eventCols+" FROM events WHERE venue = $1 ORDER BY event_date DESC", venue)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []db.Event
	for rows.Next() {
		e, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}
