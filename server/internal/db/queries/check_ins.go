package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// VenuePoint is a venue with coordinates, for checking in.
type VenuePoint struct {
	ID        string
	Name      string
	City      *string
	Latitude  float64
	Longitude float64
}

// VenuesInBox lists venues with coordinates inside a lat/lng box, for the
// caller to measure exactly.
func VenuesInBox(ctx context.Context, q DBTX, minLat, maxLat, minLng, maxLng float64) ([]VenuePoint, error) {
	rows, err := q.Query(ctx, `
		SELECT id, name, city, latitude, longitude FROM venues
		WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
		minLat, maxLat, minLng, maxLng)
	return collect(rows, err, pgx.RowToStructByPos[VenuePoint])
}

// GetVenuePoint is a venue's coordinates; ErrNotFound if it has none.
func GetVenuePoint(ctx context.Context, q DBTX, id string) (*VenuePoint, error) {
	var v VenuePoint
	err := q.QueryRow(ctx, `
		SELECT id, name, city, latitude, longitude FROM venues
		WHERE id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL`, id).
		Scan(&v.ID, &v.Name, &v.City, &v.Latitude, &v.Longitude)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// CreateCheckIn records that the user is at the venue now, unless they
// already checked in there since `since` (then it's a no-op). Either way it
// returns when their check-in there was.
func CreateCheckIn(ctx context.Context, q DBTX, userID, venueID string, distanceM int, accuracyM *int, since time.Time) (time.Time, error) {
	var at time.Time
	err := q.QueryRow(ctx, `
		SELECT created_at FROM check_ins
		WHERE user_id = $1 AND venue_id = $2 AND created_at >= $3
		ORDER BY created_at LIMIT 1`, userID, venueID, since).Scan(&at)
	if err == nil {
		return at, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, err
	}
	err = q.QueryRow(ctx, `
		INSERT INTO check_ins (user_id, venue_id, distance_m, accuracy_m)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at`, userID, venueID, distanceM, accuracyM).Scan(&at)
	return at, err
}
