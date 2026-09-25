package db

import "time"

type CrowdVibe string

const (
	CrowdVibeElectric CrowdVibe = "electric"
	CrowdVibeGood     CrowdVibe = "good"
	CrowdVibeAverage  CrowdVibe = "average"
	CrowdVibeDead     CrowdVibe = "dead"
)

func (c CrowdVibe) Valid() bool {
	switch c {
	case CrowdVibeElectric, CrowdVibeGood, CrowdVibeAverage, CrowdVibeDead:
		return true
	default:
		return false
	}
}

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

type Event struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Venue           string    `json:"venue"`
	City            *string   `json:"city"`
	EventDate       time.Time `json:"eventDate"`
	Description     *string   `json:"description"`
	CreatedByUserID *string   `json:"createdByUserId"`
	CreatedAt       time.Time `json:"createdAt"`
}

type Review struct {
	ID            string     `json:"id"`
	UserID        string     `json:"userId"`
	DjID          string     `json:"djId"`
	EventID       *string    `json:"eventId"`
	Rating        *int16     `json:"rating"`
	ReviewText    *string    `json:"reviewText"`
	CrowdVibe     *CrowdVibe `json:"crowdVibe"`
	CrowdVibeNote *string    `json:"crowdVibeNote"`
	SeenAt        time.Time  `json:"seenAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
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
