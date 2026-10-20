package httpapi

import (
	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

// ReviewDTO is a night out as the app shows it: the review, who posted it,
// its event (nil for a night with no event name), its lineup - the DJs seen,
// alphabetically, with any DJ reviews - its tags and tagged friends, and its
// likes and comments.
type ReviewDTO struct {
	db.Review
	User         *db.User         `json:"user,omitempty"`
	Event        *db.Event        `json:"event" extensions:"x-nullable"`
	Lineup       []db.LineupEntry `json:"lineup"`
	TaggedUsers  []db.User        `json:"taggedUsers"`
	Tags         []string         `json:"tags"`
	LikeCount    int64            `json:"likeCount"`
	CommentCount int64            `json:"commentCount"`
	IsLikedByMe  bool             `json:"isLikedByMe"`
	IsPopular    *bool            `json:"isPopular,omitempty"`
	// On a review's own page, when the caller is tagged in it: whether
	// they've logged the night themselves (the page prompts them to if not).
	ViewerLoggedNight *bool `json:"viewerLoggedNight,omitempty"`
}

// nextSeenAtCursor builds the opaque cursor for a seenAt-ordered,
// limit-sized page: present only when the page came back full, since
// that's the only case where there might be more rows.
func nextSeenAtCursor(reviews []db.Review, limit int) *string {
	if len(reviews) != limit {
		return nil
	}
	s := reviews[len(reviews)-1].SeenAt.Format(rfc3339)
	return &s
}

// Named response types: every handler returns a named struct, never a
// map[string]any, so swag/openapi-typescript can introspect field names and
// types instead of emitting an opaque {}.

type PaginatedReviews struct {
	Items      []ReviewDTO `json:"items"`
	NextCursor *string     `json:"nextCursor" extensions:"x-nullable"`
}

type DjDetailResponse struct {
	Dj db.Dj `json:"dj"`
	// TimesSeen is how many nights logged have them on the lineup.
	TimesSeen int64 `json:"timesSeen"`
	// ReviewCount is how many of those say something about their set.
	ReviewCount   int64       `json:"reviewCount"`
	RecentReviews []ReviewDTO `json:"recentReviews"`
}

type EventDetailResponse struct {
	Event         queries.EventSummary `json:"event"`
	Djs           []queries.EventDj    `json:"djs"`
	Venues        []queries.EventVenue `json:"venues"`
	RecentReviews []ReviewDTO          `json:"recentReviews"`
}

type VenueDetailResponse struct {
	Venue         queries.VenueSummary `json:"venue"`
	Events        []queries.VenueEvent `json:"events"`
	RecentReviews []ReviewDTO          `json:"recentReviews"`
}

type UserProfileResponse struct {
	User db.User `json:"user"`
	// ReviewCount is how many nights out they've logged.
	ReviewCount    int64 `json:"reviewCount"`
	FollowerCount  int64 `json:"followerCount"`
	FollowingCount int64 `json:"followingCount"`
}

type UserStatsResponse struct {
	// TotalReviews is how many nights out they've logged.
	TotalReviews int64              `json:"totalReviews"`
	UniqueDjs    int64              `json:"uniqueDjs"`
	TopDjs       []queries.TopDj    `json:"topDjs"`
	RecentDjs    []queries.RecentDj `json:"recentDjs"`
	TopVenues    []queries.TopVenue `json:"topVenues"`
	// Passport is every venue they've logged a night at, first visit first.
	Passport []queries.PassportStamp `json:"passport"`
}

type FeedResponse struct {
	Items          []ReviewDTO `json:"items"`
	NextCursor     *string     `json:"nextCursor" extensions:"x-nullable"`
	FollowingCount int         `json:"followingCount"`
}

type PopularResponse struct {
	Items []ReviewDTO `json:"items"`
}

type SuccessResponse struct {
	Success bool `json:"success"`
}

type FollowingStatusResponse struct {
	Following bool `json:"following"`
}

type FavoriteReviewsResponse struct {
	Items []ReviewDTO `json:"items"`
}
