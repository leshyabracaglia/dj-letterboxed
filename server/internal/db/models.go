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

// EventSeries is a recurring event ("Innervisions") that nights at
// different venues and dates belong to.
type EventSeries struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Slug            string    `json:"slug"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
}

// Event is one night: a series (or just a venue) on a date.
type Event struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// SeriesID is nil for a night that isn't part of a named event.
	SeriesID *string `json:"seriesId"`
	// Venue is the venue's display name, kept denormalized alongside
	// VenueID so existing displays don't need a join.
	Venue           string    `json:"venue"`
	VenueID         *string   `json:"venueId"`
	City            *string   `json:"city"`
	EventDate       time.Time `json:"eventDate"`
	Description     *string   `json:"description"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
}

type Review struct {
	ID         string    `json:"id"`
	UserID string `json:"userId"`
	// DjID is nil for a review of the night as a whole (EventID is then set).
	DjID       *string   `json:"djId"`
	EventID    *string   `json:"eventId"`
	Rating     *int16    `json:"rating"`
	ReviewText *string   `json:"reviewText"`
	SeenAt     time.Time `json:"seenAt"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
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
