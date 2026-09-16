package httpapi

import (
	"context"
	"net/http"

	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// fetchPopularReviews ports feed.ts's fetchPopularReviews: rank review ids
// by engagement, fetch+hydrate them preserving rank order, tag isPopular.
func (h *Handlers) fetchPopularReviews(ctx context.Context, limit, offset int, excludeIDs []string, currentUserID *string) ([]ReviewDTO, error) {
	if limit <= 0 {
		return []ReviewDTO{}, nil
	}

	ids, err := queries.RankPopularReviewIDs(ctx, h.Pool, limit, offset, excludeIDs)
	if err != nil {
		return nil, err
	}

	reviews, err := queries.GetReviewsByIDsOrdered(ctx, h.Pool, ids)
	if err != nil {
		return nil, err
	}

	dtos, err := h.hydrateReviews(ctx, reviews, hydrateOpts{
		IncludeUser: true, IncludeDj: true, IncludeEvent: true,
		IncludeEngagement: true, CurrentUserID: currentUserID,
	})
	if err != nil {
		return nil, err
	}

	for i := range dtos {
		dtos[i] = dtos[i].withPopular(true)
	}
	return dtos, nil
}

// GetActivity godoc
//
//	@Summary	Activity feed: followed users' reviews interleaved with popular ones every 4th item
//	@Tags		feed
//	@Produce	json
//	@Param		cursor	query		string	false	"pagination cursor (opaque, encodes createdAt + popular-pool offset)"
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

	followedReviews, err := queries.ListReviewsByUserIDs(r.Context(), h.Pool, followedIDs, cursor.CreatedAt, limit)
	if err != nil {
		InternalError(w, err)
		return
	}

	excludeIDs := make([]string, len(followedReviews))
	for i, rv := range followedReviews {
		excludeIDs[i] = rv.ID
	}
	popularLimit := len(followedReviews) / domain.PopularInterleaveEvery

	followedDTOs, err := h.hydrateReviews(r.Context(), followedReviews, hydrateOpts{
		IncludeUser: true, IncludeDj: true, IncludeEvent: true,
		IncludeEngagement: true, CurrentUserID: &user.ID,
	})
	if err != nil {
		InternalError(w, err)
		return
	}
	for i := range followedDTOs {
		followedDTOs[i] = followedDTOs[i].withPopular(false)
	}

	popularDTOs, err := h.fetchPopularReviews(r.Context(), popularLimit, cursor.PopularOffset, excludeIDs, &user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}

	items := interleaveFeed(followedDTOs, popularDTOs)

	var nextCursor *string
	if len(followedReviews) >= limit {
		last := followedReviews[len(followedReviews)-1]
		enc := domain.EncodeCursor(domain.Cursor{
			CreatedAt:     &last.CreatedAt,
			PopularOffset: cursor.PopularOffset + len(popularDTOs),
		})
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
//	@Summary	Most-liked-and-commented reviews, ranked
//	@Tags		feed
//	@Produce	json
//	@Param		limit	query		int	false	"page size, 1-50, default 20"
//	@Success	200		{object}	PopularResponse
//	@Router		/api/feed/popular [get]
func (h *Handlers) GetPopular(w http.ResponseWriter, r *http.Request) {
	limit := queryLimit(r, 20, 50)

	items, err := h.fetchPopularReviews(r.Context(), limit, 0, nil, optionalUserID(r))
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, PopularResponse{Items: items})
}

// interleaveFeed splices a popular item in after every Nth followed item,
// matching feed.ts's getActivity interleave behavior exactly.
func interleaveFeed(followed, popular []ReviewDTO) []ReviewDTO {
	out := make([]ReviewDTO, 0, len(followed)+len(popular))
	popIdx := 0
	for i, item := range followed {
		out = append(out, item)
		if (i+1)%domain.PopularInterleaveEvery == 0 && popIdx < len(popular) {
			out = append(out, popular[popIdx])
			popIdx++
		}
	}
	return out
}
