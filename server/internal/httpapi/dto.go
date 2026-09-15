package httpapi

import (
	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

// ReviewDTO flattens a review with its relations and engagement counts
// onto one JSON object, matching the shape the tRPC routers used to
// produce (review fields + user/dj/event + likeCount/commentCount/
// isLikedByMe, spread onto one object rather than nested).
type ReviewDTO struct {
	db.Review
	User         *db.User  `json:"user,omitempty"`
	Dj           *db.Dj    `json:"dj,omitempty"`
	Event        *db.Event `json:"event,omitempty"`
	TaggedUsers  []db.User `json:"taggedUsers,omitempty"`
	LikeCount    *int64    `json:"likeCount,omitempty"`
	CommentCount *int64    `json:"commentCount,omitempty"`
	IsLikedByMe  *bool     `json:"isLikedByMe,omitempty"`
	IsPopular    *bool     `json:"isPopular,omitempty"`
}

func newReviewDTO(r db.Review) ReviewDTO {
	return ReviewDTO{Review: r}
}

func (d ReviewDTO) withEngagement(e queries.Engagement) ReviewDTO {
	lc, cc, lm := e.LikeCount, e.CommentCount, e.IsLikedByMe
	d.LikeCount = &lc
	d.CommentCount = &cc
	d.IsLikedByMe = &lm
	return d
}

func (d ReviewDTO) withPopular(isPopular bool) ReviewDTO {
	d.IsPopular = &isPopular
	return d
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

// Named response types for every handler that used to return an ad-hoc
// map[string]any literal. Named structs (not maps) are what let swag/
// openapi-typescript actually introspect field names and types instead of
// emitting an opaque {} — this is also just better Go.

type PaginatedReviews struct {
	Items      []ReviewDTO `json:"items"`
	NextCursor *string     `json:"nextCursor"`
}

type DjDetailResponse struct {
	Dj         db.Dj       `json:"dj"`
	AvgRating  *float64    `json:"avgRating"`
	LogCount   int64       `json:"logCount"`
	RecentLogs []ReviewDTO `json:"recentLogs"`
}

type EventDetailResponse struct {
	Event db.Event    `json:"event"`
	Logs  []ReviewDTO `json:"logs"`
}

type UserProfileResponse struct {
	User           db.User `json:"user"`
	LogCount       int64   `json:"logCount"`
	FollowerCount  int64   `json:"followerCount"`
	FollowingCount int64   `json:"followingCount"`
}

type UserStatsResponse struct {
	TotalLogs int64              `json:"totalLogs"`
	UniqueDjs int64              `json:"uniqueDjs"`
	TopDjs    []queries.TopDj    `json:"topDjs"`
	TopVenues []queries.TopVenue `json:"topVenues"`
}

type FeedResponse struct {
	Items          []ReviewDTO `json:"items"`
	NextCursor     *string     `json:"nextCursor"`
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
