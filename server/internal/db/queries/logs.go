package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// A log is one person's night out; its reviews point at it via
// reviews.log_id and its lineup lives in log_lineup.

const logCols = "id, user_id, event_id, venue, venue_id, city, seen_at, is_day, is_night, created_at"

func scanLog(row pgx.Row) (*db.Log, error) {
	var l db.Log
	err := row.Scan(&l.ID, &l.UserID, &l.EventID, &l.Venue, &l.VenueID, &l.City, &l.SeenAt, &l.IsDay, &l.IsNight, &l.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &l, nil
}

type CreateLogParams struct {
	UserID  string
	EventID *string
	Venue   *db.Venue
	City    *string
	SeenAt  time.Time
	IsDay   bool
	IsNight bool
}

// CreateLog stores venue.Name as the log's denormalized venue name.
func CreateLog(ctx context.Context, q DBTX, p CreateLogParams) (*db.Log, error) {
	return scanLog(q.QueryRow(ctx, `
		INSERT INTO logs (user_id, event_id, venue, venue_id, city, seen_at, is_day, is_night)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING `+logCols,
		p.UserID, p.EventID, p.Venue.Name, p.Venue.ID, p.City, p.SeenAt, p.IsDay, p.IsNight))
}

// GetLogsByIDs batch-fetches logs for hydrating reviews, keyed by id.
func GetLogsByIDs(ctx context.Context, q DBTX, ids []string) (map[string]db.Log, error) {
	out := make(map[string]db.Log, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, "SELECT "+logCols+" FROM logs WHERE id = ANY($1)", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		l, err := scanLog(rows)
		if err != nil {
			return nil, err
		}
		out[l.ID] = *l
	}
	return out, rows.Err()
}

// AddLogLineup records the DJs someone saw on their night out; DJs already
// listed are left alone.
func AddLogLineup(ctx context.Context, q DBTX, logID string, djIDs []string) error {
	if len(djIDs) == 0 {
		return nil
	}
	_, err := q.Exec(ctx, `
		INSERT INTO log_lineup (log_id, dj_id)
		SELECT $1, unnest($2::uuid[])
		ON CONFLICT DO NOTHING`, logID, djIDs)
	return err
}

// GetLineupsByLogIDs returns each given log's lineup, alphabetically, keyed
// by log id. Logs with an empty lineup are left out.
func GetLineupsByLogIDs(ctx context.Context, q DBTX, logIDs []string) (map[string][]db.Dj, error) {
	out := make(map[string][]db.Dj)
	if len(logIDs) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT ll.log_id, d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at
		FROM log_lineup ll
		JOIN djs d ON d.id = ll.dj_id
		WHERE ll.log_id = ANY($1)
		ORDER BY ll.log_id, lower(d.name)`, logIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var logID string
		var d db.Dj
		if err := rows.Scan(&logID, &d.ID, &d.Name, &d.Slug, &d.Bio, &d.Genres, &d.ImageURL, &d.SpotifyID, &d.CreatedByUserID, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		out[logID] = append(out[logID], d)
	}
	return out, rows.Err()
}

// DeleteLogIfEmpty removes a log once its last review is gone, so a night
// with nothing written about it doesn't linger on event and venue pages.
func DeleteLogIfEmpty(ctx context.Context, q DBTX, logID string) error {
	_, err := q.Exec(ctx, `
		DELETE FROM logs l
		WHERE l.id = $1 AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.log_id = l.id)`, logID)
	return err
}
