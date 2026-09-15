package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

const eventCols = "id, name, venue, city, event_date, description, created_by_user_id, created_at"

func scanEvent(row pgx.Row) (*db.Event, error) {
	var e db.Event
	err := row.Scan(&e.ID, &e.Name, &e.Venue, &e.City, &e.EventDate, &e.Description, &e.CreatedByUserID, &e.CreatedAt)
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

func GetEventByExactMatch(ctx context.Context, q DBTX, name, venue string, eventDate time.Time) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, "SELECT "+eventCols+" FROM events WHERE name = $1 AND venue = $2 AND event_date = $3", name, venue, eventDate))
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

func CreateEvent(ctx context.Context, q DBTX, name, venue string, city *string, eventDate time.Time, description *string, createdByUserID string) (*db.Event, error) {
	return scanEvent(q.QueryRow(ctx, `
		INSERT INTO events (name, venue, city, event_date, description, created_by_user_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+eventCols, name, venue, city, eventDate, description, createdByUserID))
}
