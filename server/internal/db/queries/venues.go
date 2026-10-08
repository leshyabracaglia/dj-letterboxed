package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// A venue is either linked to a Google Places place (google_place_id set,
// unique) or was typed in by hand (no place id, unique by lower(name)).
// Logs point at one via logs.venue_id.

const venueCols = "id, name, city, address, google_place_id, latitude, longitude, created_by_user_id, created_at"

func scanVenue(row pgx.Row) (*db.Venue, error) {
	var v db.Venue
	err := row.Scan(&v.ID, &v.Name, &v.City, &v.Address, &v.GooglePlaceID, &v.Latitude, &v.Longitude, &v.CreatedByUserID, &v.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}

type VenueSummary struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	City          *string `json:"city"`
	Address       *string `json:"address"`
	GooglePlaceID *string `json:"googlePlaceId"`
	// LogCount is how many nights out people have logged there.
	LogCount int64 `json:"logCount"`
}

const venueSummarySelect = `
	SELECT v.id, v.name, v.city, v.address, v.google_place_id, COUNT(l.id) AS log_count
	FROM venues v
	LEFT JOIN logs l ON l.venue_id = v.id`

func scanVenueSummary(row pgx.Row) (*VenueSummary, error) {
	var v VenueSummary
	if err := row.Scan(&v.ID, &v.Name, &v.City, &v.Address, &v.GooglePlaceID, &v.LogCount); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}

// SearchVenues matches saved venues by name, busiest first; an empty query
// returns the busiest venues overall.
func SearchVenues(ctx context.Context, q DBTX, query string, limit int) ([]VenueSummary, error) {
	rows, err := q.Query(ctx, venueSummarySelect+`
		WHERE $1 = '' OR v.name ILIKE '%' || $1 || '%'
		GROUP BY v.id
		ORDER BY log_count DESC, v.name
		LIMIT $2`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []VenueSummary
	for rows.Next() {
		v, err := scanVenueSummary(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

func GetVenueSummary(ctx context.Context, q DBTX, id string) (*VenueSummary, error) {
	return scanVenueSummary(q.QueryRow(ctx, venueSummarySelect+`
		WHERE v.id = $1
		GROUP BY v.id`, id))
}

func GetVenueByID(ctx context.Context, q DBTX, id string) (*db.Venue, error) {
	return scanVenue(q.QueryRow(ctx, "SELECT "+venueCols+" FROM venues WHERE id = $1", id))
}

func GetVenueByPlaceID(ctx context.Context, q DBTX, placeID string) (*db.Venue, error) {
	return scanVenue(q.QueryRow(ctx, "SELECT "+venueCols+" FROM venues WHERE google_place_id = $1", placeID))
}

type CreatePlaceVenueParams struct {
	GooglePlaceID   string
	Name            string
	City            *string
	Address         *string
	Latitude        *float64
	Longitude       *float64
	CreatedByUserID string
}

// UpsertPlaceVenue creates the venue for a Google place, or returns the
// existing one if another request linked the same place first.
func UpsertPlaceVenue(ctx context.Context, q DBTX, p CreatePlaceVenueParams) (*db.Venue, error) {
	return scanVenue(q.QueryRow(ctx, `
		INSERT INTO venues (name, city, address, google_place_id, latitude, longitude, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (google_place_id) WHERE google_place_id IS NOT NULL
		DO UPDATE SET google_place_id = venues.google_place_id
		RETURNING `+venueCols,
		p.Name, p.City, p.Address, p.GooglePlaceID, p.Latitude, p.Longitude, p.CreatedByUserID))
}

// UpsertUnlinkedVenue finds or creates a hand-typed venue (no Google place),
// matched case-insensitively by name.
func UpsertUnlinkedVenue(ctx context.Context, q DBTX, name string, city *string, createdByUserID string) (*db.Venue, error) {
	return scanVenue(q.QueryRow(ctx, `
		INSERT INTO venues (name, city, created_by_user_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (lower(name)) WHERE google_place_id IS NULL
		DO UPDATE SET city = COALESCE(venues.city, EXCLUDED.city)
		RETURNING `+venueCols, name, city, createdByUserID))
}

// VenueEvent is a named event logged at a venue, with how many logs there.
type VenueEvent struct {
	Event    db.Event `json:"event"`
	LogCount int64    `json:"logCount"`
}

// ListVenueEvents returns the events people have logged at a venue, most
// logged first.
func ListVenueEvents(ctx context.Context, q DBTX, venueID string) ([]VenueEvent, error) {
	rows, err := q.Query(ctx, `
		SELECT e.id, e.name, e.slug, e.created_by_user_id, e.created_at, COUNT(l.id) AS log_count
		FROM logs l
		JOIN events e ON e.id = l.event_id
		WHERE l.venue_id = $1
		GROUP BY e.id
		ORDER BY log_count DESC, MAX(l.seen_at) DESC`, venueID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []VenueEvent
	for rows.Next() {
		var v VenueEvent
		e := &v.Event
		if err := rows.Scan(&e.ID, &e.Name, &e.Slug, &e.CreatedByUserID, &e.CreatedAt, &v.LogCount); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
