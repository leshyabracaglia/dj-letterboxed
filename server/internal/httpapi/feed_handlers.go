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

func (h *Handlers) GetActivity(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	followedIDs, err := queries.GetFollowingIDs(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	if len(followedIDs) == 0 {
		WriteJSON(w, http.StatusOK, map[string]any{
			"items": []ReviewDTO{}, "nextCursor": nil, "followingCount": 0,
		})
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

	WriteJSON(w, http.StatusOK, map[string]any{
		"items":          items,
		"nextCursor":     nextCursor,
		"followingCount": len(followedIDs),
	})
}

func (h *Handlers) GetPopular(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	limit := queryLimit(r, 20, 50)

	items, err := h.fetchPopularReviews(r.Context(), limit, 0, nil, &user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"items": items})
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
