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
