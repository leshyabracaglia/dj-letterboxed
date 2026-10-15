package db

import "time"

type User struct {
	ID          string    `json:"id"`
	ClerkID     string    `json:"-"`
	Username    string    `json:"username"`
	DisplayName *string   `json:"displayName" extensions:"x-nullable"`
	Bio         *string   `json:"bio" extensions:"x-nullable"`
	AvatarURL   *string   `json:"avatarUrl" extensions:"x-nullable"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Dj struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Slug            string    `json:"slug"`
	Bio             *string   `json:"bio" extensions:"x-nullable"`
	Genres          []string  `json:"genres"`
	ImageURL        *string   `json:"imageUrl" extensions:"x-nullable"`
	SpotifyID       *string   `json:"spotifyId" extensions:"x-nullable"`
	CreatedByUserID *string   `json:"createdByUserId" extensions:"x-nullable"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type Venue struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	City            *string   `json:"city" extensions:"x-nullable"`
	Address         *string   `json:"address" extensions:"x-nullable"`
	GooglePlaceID   *string   `json:"googlePlaceId" extensions:"x-nullable"`
	Latitude        *float64  `json:"latitude" extensions:"x-nullable"`
	Longitude       *float64  `json:"longitude" extensions:"x-nullable"`
	CreatedByUserID *string   `json:"createdByUserId" extensions:"x-nullable"`
	CreatedAt       time.Time `json:"createdAt"`
}

// Event is a named party ("Innervisions NY"): it can happen at many venues
// on many dates, and collects every log of it. Unique by lower(name) and
// slug.
type Event struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Slug            string    `json:"slug"`
	CreatedByUserID *string   `json:"createdByUserId" extensions:"x-nullable"`
	CreatedAt       time.Time `json:"createdAt"`
}

// Review is one person's night out, and the post: which event (if it had a
// name), where, which day, whether they went during the day, at night or
// both, and what they thought of it. The DJs they saw, each optionally rated,
// are its lineup (review_lineup); likes, comments, tagged friends and tags
// hang off it too.
type Review struct {
	ID     string `json:"id"`
	UserID string `json:"userId"`
	// EventID is nil for a night with no event name (just a venue).
	EventID *string `json:"eventId" extensions:"x-nullable"`
	// Venue is the venue's display name, denormalized alongside VenueID.
	// Both are nil only on nights migrated from reviews that never had one.
	Venue   *string   `json:"venue" extensions:"x-nullable"`
	VenueID *string   `json:"venueId" extensions:"x-nullable"`
	City    *string   `json:"city" extensions:"x-nullable"`
	SeenAt  time.Time `json:"seenAt"`
	// IsDay and IsNight say when this person went; both is day into night.
	// At least one is set.
	IsDay   bool `json:"isDay"`
	IsNight bool `json:"isNight"`
	// Rating of the night as a whole, 1-5. Nil only on nights logged before
	// nights were rated, which only rated their DJs.
	Rating     *int16    `json:"rating" extensions:"x-nullable"`
	ReviewText *string   `json:"reviewText" extensions:"x-nullable"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
	// Verified is whether this person checked in at the venue that night
	// (see the check_ins table), worked out when the review is read.
	Verified bool `json:"verified"`
}

// LineupEntry is a DJ someone saw on their night out, with their rating of
// that DJ's set (a DJ review) if they gave one.
type LineupEntry struct {
	Dj         Dj      `json:"dj"`
	Rating     *int16  `json:"rating" extensions:"x-nullable"`
	ReviewText *string `json:"reviewText" extensions:"x-nullable"`
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
