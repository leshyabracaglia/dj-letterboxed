package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

const eventCols = "id, name, series_id, venue, venue_id, city, event_date, is_day, is_night, description, created_by_user_id, created_at"

func scanEvent(row pgx.Row) (*db.Event, error) {
	var e db.Event
	err := row.Scan(&e.ID, &e.Name, &e.SeriesID, &e.Venue, &e.VenueID, &e.City, &e.EventDate, &e.IsDay, &e.IsNight, &e.Description, &e.CreatedByUserID, &e.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

func SearchEvents(ctx context.Context, q DBTX, query string) ([]db.Event, error) {
	rows, err := q.Query(ctx, "SELECT "+eventCols+" FROM events WHERE name ILIKE '%' || $1 || '%' LIMIT 20", query)
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

func GetEventByID(ctx context.Context, q DBTX, id string) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, "SELECT "+eventCols+" FROM events WHERE id = $1", id))
}

func GetEventByExactMatch(ctx context.Context, q DBTX, name, venueID string, eventDate time.Time) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, "SELECT "+eventCols+" FROM events WHERE name = $1 AND venue_id = $2 AND event_date = $3", name, venueID, eventDate))
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

// GetNight finds the night a log belongs to: the same series (or no series)
// at the same venue on the same calendar day, and the same day/night timing. Days compare in UTC, which
// keeps a midday-local seenAt on its own day for nearly every time zone.
func GetNight(ctx context.Context, q DBTX, seriesID *string, venueID string, date time.Time, isDay, isNight bool) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, `
		SELECT `+eventCols+` FROM events
		WHERE venue_id = $1
			AND series_id IS NOT DISTINCT FROM $2
			AND (event_date AT TIME ZONE 'UTC')::date = ($3::timestamptz AT TIME ZONE 'UTC')::date
			AND is_day = $4 AND is_night = $5
		ORDER BY created_at
		LIMIT 1`, venueID, seriesID, date, isDay, isNight))
}

// CreateEvent stores venue.Name as the event's denormalized venue name.
func CreateEvent(ctx context.Context, q DBTX, name string, seriesID *string, venue *db.Venue, city *string, eventDate time.Time, isDay, isNight bool, description *string, createdByUserID string) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, `
		INSERT INTO events (name, series_id, venue, venue_id, city, event_date, is_day, is_night, description, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+eventCols, name, seriesID, venue.Name, venue.ID, city, eventDate, isDay, isNight, description, createdByUserID))
}

// AddToLineup records DJs as having played a night; already-listed DJs are
// left alone.
func AddToLineup(ctx context.Context, q DBTX, eventID string, djIDs []string, addedByUserID string) error {
	if len(djIDs) == 0 {
		return nil
	}
	_, err := q.Exec(ctx, `
		INSERT INTO event_lineup (event_id, dj_id, added_by_user_id)
		SELECT $1, unnest($2::uuid[]), $3
		ON CONFLICT DO NOTHING`, eventID, djIDs, addedByUserID)
	return err
}

// GetSoloLineupDjs returns, for each of the given nights whose lineup is
// exactly one DJ, that DJ keyed by event id. Nights with an empty or
// multi-DJ lineup are left out.
func GetSoloLineupDjs(ctx context.Context, q DBTX, eventIDs []string) (map[string]db.Dj, error) {
	out := make(map[string]db.Dj)
	if len(eventIDs) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT l.event_id, d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at
		FROM event_lineup l
		JOIN djs d ON d.id = l.dj_id
		WHERE l.event_id IN (
			SELECT event_id FROM event_lineup
			WHERE event_id = ANY($1)
			GROUP BY event_id
			HAVING COUNT(*) = 1
		)`, eventIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var eventID string
		var d db.Dj
		if err := rows.Scan(&eventID, &d.ID, &d.Name, &d.Slug, &d.Bio, &d.Genres, &d.ImageURL, &d.SpotifyID, &d.CreatedByUserID, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		out[eventID] = d
	}
	return out, rows.Err()
}

// ListLineup returns a night's DJs, alphabetically.
func ListLineup(ctx context.Context, q DBTX, eventID string) ([]db.Dj, error) {
	rows, err := q.Query(ctx, `
		SELECT `+djCols+` FROM djs
		WHERE id IN (SELECT dj_id FROM event_lineup WHERE event_id = $1)
		ORDER BY lower(name)`, eventID)
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
