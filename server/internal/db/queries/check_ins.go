package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// VenuePoint is a venue with coordinates, for checking in.
type VenuePoint struct {
	ID        string
	Name      string
	City      *string
	Latitude  float64
	Longitude float64
	// GooglePlaceID is set when the venue is a Google Places place.
	GooglePlaceID *string
}

// VenuesInBox lists venues with coordinates inside a lat/lng box, for the
// caller to measure exactly.
func VenuesInBox(ctx context.Context, q DBTX, minLat, maxLat, minLng, maxLng float64) ([]VenuePoint, error) {
	rows, err := q.Query(ctx, `
		SELECT id, name, city, latitude, longitude, google_place_id FROM venues
		WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`,
		minLat, maxLat, minLng, maxLng)
	return collect(rows, err, pgx.RowToStructByPos[VenuePoint])
}

// GetVenuePoint is a venue's coordinates; ErrNotFound if it has none.
func GetVenuePoint(ctx context.Context, q DBTX, id string) (*VenuePoint, error) {
	var v VenuePoint
	err := q.QueryRow(ctx, `
		SELECT id, name, city, latitude, longitude, google_place_id FROM venues
		WHERE id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL`, id).
		Scan(&v.ID, &v.Name, &v.City, &v.Latitude, &v.Longitude, &v.GooglePlaceID)
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

// unloggedCheckInCond is true when check-in c has no night logged by its
// person at its venue covering it - the same window that makes a review
// verified (reviewVerifiedExpr), looked at from the check-in's side.
const unloggedCheckInCond = `NOT EXISTS (
	SELECT 1 FROM reviews r
	WHERE r.user_id = c.user_id AND r.venue_id = c.venue_id
		AND c.created_at >= r.seen_at - interval '12 hours'
		AND c.created_at < r.seen_at + interval '20 hours'
)`

// CheckInVenue is the club a check-in was at.
type CheckInVenue struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	City *string `json:"city" extensions:"x-nullable"`
}

// CheckInPost is a check-in shown on its own: someone was at a club and
// hasn't logged the night.
type CheckInPost struct {
	ID        string       `json:"id"`
	CreatedAt time.Time    `json:"createdAt"`
	User      db.User      `json:"user"`
	Venue     CheckInVenue `json:"venue"`
}

// ListUnloggedCheckIns returns the check-ins by userIDs with no logged night
// covering them, newest first: those since `since` when it's set, else the
// latest `limit`.
func ListUnloggedCheckIns(ctx context.Context, q DBTX, userIDs []string, since *time.Time, limit int) ([]CheckInPost, error) {
	rows, err := q.Query(ctx, `
		SELECT c.id, c.created_at, `+qualifiedUserCols+`, v.id, v.name, v.city
		FROM check_ins c
		JOIN users u ON u.id = c.user_id
		JOIN venues v ON v.id = c.venue_id
		WHERE c.user_id = ANY($1) AND ($2::timestamptz IS NULL OR c.created_at >= $2) AND `+unloggedCheckInCond+`
		ORDER BY c.created_at DESC
		LIMIT $3`, userIDs, since, limit)
	return collect(rows, err, func(row pgx.CollectableRow) (CheckInPost, error) {
		var p CheckInPost
		u := &p.User
		err := row.Scan(&p.ID, &p.CreatedAt, &u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL,
			&u.CreatedAt, &u.UpdatedAt, &u.City, &p.Venue.ID, &p.Venue.Name, &p.Venue.City)
		return p, err
	})
}

// FriendIDs returns the ids of userID's friends (mutual follows).
func FriendIDs(ctx context.Context, q DBTX, userID string) ([]string, error) {
	rows, err := q.Query(ctx, `
		SELECT f1.following_id FROM follows f1
		JOIN follows f2 ON f2.follower_id = f1.following_id AND f2.following_id = f1.follower_id
		WHERE f1.follower_id = $1`, userID)
	return collect(rows, err, pgx.RowTo[string])
}

// AreFriends reports whether a and b follow each other.
func AreFriends(ctx context.Context, q DBTX, a, b string) (bool, error) {
	var friends bool
	err := q.QueryRow(ctx, "SELECT "+mutualFollowCond("$1::uuid", "$2::uuid"), a, b).Scan(&friends)
	return friends, err
}

// VenueCheckIns is who's been to a venue by checking in: how many people
// ever have, and which of them are the viewer's friends (most recent first).
type VenueCheckIns struct {
	People  int       `json:"people"`
	Friends []db.User `json:"friends"`
}

// GetVenueCheckIns counts everyone who's checked in at venueID and lists
// viewerID's friends among them (none when viewerID is nil).
func GetVenueCheckIns(ctx context.Context, q DBTX, venueID string, viewerID *string) (*VenueCheckIns, error) {
	out := &VenueCheckIns{Friends: []db.User{}}
	if err := q.QueryRow(ctx, "SELECT COUNT(DISTINCT user_id) FROM check_ins WHERE venue_id = $1", venueID).
		Scan(&out.People); err != nil {
		return nil, err
	}
	if viewerID == nil {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedUserCols+`
		FROM users u
		JOIN (SELECT user_id, MAX(created_at) AS last_at FROM check_ins WHERE venue_id = $1 GROUP BY user_id) c
			ON c.user_id = u.id
		WHERE u.id <> $2 AND `+mutualFollowCond("$2::uuid", "u.id")+`
		ORDER BY c.last_at DESC`, venueID, *viewerID)
	friends, err := collect(rows, err, rowsOf(scanUser))
	if err != nil {
		return nil, err
	}
	out.Friends = friends
	return out, nil
}
