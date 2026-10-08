package db

import "time"

type User struct {
	ID          string    `json:"id"`
	ClerkID     string    `json:"-"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName"`
	Bio         *string   `json:"bio"`
	AvatarURL   *string   `json:"avatarUrl"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Dj struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Slug            string    `json:"slug"`
	Bio             *string   `json:"bio"`
	Genres          []string  `json:"genres"`
	ImageURL        *string   `json:"imageUrl"`
	SpotifyID       *string   `json:"spotifyId"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Venue struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	City            *string   `json:"city"`
	Address         *string   `json:"address"`
	GooglePlaceID   *string   `json:"googlePlaceId"`
	Latitude        *float64  `json:"latitude"`
	Longitude       *float64  `json:"longitude"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
}

// Event is a named party ("Innervisions NY"): it can happen at many venues
// on many dates, and collects every log of it. Unique by lower(name) and
// slug.
type Event struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Slug            string    `json:"slug"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
}

// Log is one person's night out: which event (if it had a name), where,
// which day, and whether they went during the day, at night, or both. Its
// reviews (of the night as a whole and of DJs) and lineup hang off it.
type Log struct {
	ID     string `json:"id"`
	UserID string `json:"userId"`
	// EventID is nil for a night with no event name (just a venue).
	EventID *string `json:"eventId"`
	// Venue is the venue's display name, denormalized alongside VenueID.
	// Both are nil only on logs migrated from reviews that had no night.
	Venue   *string   `json:"venue"`
	VenueID *string   `json:"venueId"`
	City    *string   `json:"city"`
	SeenAt  time.Time `json:"seenAt"`
	// IsDay and IsNight say when this person went; both is day into night.
	// At least one is set.
	IsDay     bool      `json:"isDay"`
	IsNight   bool      `json:"isNight"`
	CreatedAt time.Time `json:"createdAt"`
}

type Review struct {
	ID     string `json:"id"`
	UserID string `json:"userId"`
	LogID  string `json:"logId"`
	// DjID is nil for a review of the night as a whole.
	DjID       *string `json:"djId"`
	Rating     *int16  `json:"rating"`
	ReviewText *string `json:"reviewText"`
	// SeenAt mirrors the log's, kept here for ordering and pagination.
	SeenAt    time.Time `json:"seenAt"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ReviewComment struct {
	ID        string    `json:"id"`
	ReviewID  string    `json:"reviewId"`
	UserID    string    `json:"userId"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
	User      *User     `json:"user,omitempty"`
}

type Follow struct {
	FollowerID  string    `json:"followerId"`
	FollowingID string    `json:"followingId"`
	CreatedAt   time.Time `json:"createdAt"`
}
