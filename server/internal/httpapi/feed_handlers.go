package httpapi

import (
	"net/http"

	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// GetActivity godoc
//
//	@Summary	Following feed: followed users' nights out, newest logged first
//	@Tags		feed
//	@Produce	json
//	@Param		cursor	query		string	false	"pagination cursor (opaque, encodes the last item's createdAt)"
//	@Param		limit	query		int		false	"page size, 1-50, default 20"
//	@Success	200		{object}	FeedResponse
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/feed [get]
func (h *Handlers) GetActivity(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}

	followedIDs, err := queries.GetFollowingIDs(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	if len(followedIDs) == 0 {
		WriteJSON(w, http.StatusOK, FeedResponse{Items: []ReviewDTO{}, NextCursor: nil, FollowingCount: 0})
		return
	}

	limit := queryLimit(r, 20, 50)
	cursor := domain.DecodeCursor(r.URL.Query().Get("cursor"))

	reviews, err := queries.ListReviewsByUserIDs(r.Context(), h.Pool, followedIDs, cursor.CreatedAt, limit)
	if err != nil {
		InternalError(w, err)
		return
	}
	items, ok := h.visibleReviews(w, r, reviews)
	if !ok {
		return
	}

	var nextCursor *string
	if len(reviews) >= limit {
		enc := domain.EncodeCursor(domain.Cursor{CreatedAt: &reviews[len(reviews)-1].CreatedAt})
		nextCursor = &enc
	}

	WriteJSON(w, http.StatusOK, FeedResponse{
		Items:          items,
		NextCursor:     nextCursor,
		FollowingCount: len(followedIDs),
	})
}

// GetPopular godoc
//
//	@Summary	Most-liked-and-commented nights out, ranked
//	@Tags		feed
//	@Produce	json
//	@Param		limit	query		int	false	"page size, 1-50, default 20"
//	@Success	200		{object}	PopularResponse
//	@Router		/api/feed/popular [get]
func (h *Handlers) GetPopular(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	limit := queryLimit(r, 20, 50)

	ids, err := queries.RankPopularReviewIDs(ctx, h.Pool, limit)
	if err != nil {
		InternalError(w, err)
		return
	}
	reviews, err := queries.GetReviewsByIDsOrdered(ctx, h.Pool, ids)
	if err != nil {
		InternalError(w, err)
		return
	}
	items, ok := h.visibleReviews(w, r, reviews)
	if !ok {
		return
	}
	popular := true
	for i := range items {
		items[i].IsPopular = &popular
	}
	WriteJSON(w, http.StatusOK, PopularResponse{Items: items})
}
