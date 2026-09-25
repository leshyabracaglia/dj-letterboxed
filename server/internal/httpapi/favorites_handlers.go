package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db/queries"
)

const maxFavoriteReviews = 3

// GetFavoriteReviews godoc
//
//	@Summary	Get a user's showcased favorite reviews (top 3, ordered, #1 first)
//	@Tags		users
//	@Produce	json
//	@Param		username	path		string	true	"username"
//	@Success	200			{object}	FavoriteReviewsResponse
//	@Failure	404			{object}	errorEnvelope
//	@Router		/api/users/{username}/favorites [get]
func (h *Handlers) GetFavoriteReviews(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")

	u, err := queries.GetUserByUsername(r.Context(), h.Pool, username)
	user, ok := fetchOr404(w, u, err)
	if !ok {
		return
	}

	reviews, err := queries.GetFavoriteReviews(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}

	dtos, err := h.hydrateReviews(r.Context(), reviews, hydrateOpts{
		IncludeDj: true, IncludeEvent: true, IncludeEngagement: true, CurrentUserID: optionalUserID(r),
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, FavoriteReviewsResponse{Items: dtos})
}

type setFavoritesRequest struct {
	ReviewIDs []string `json:"reviewIds"`
}

// SetFavoriteReviews godoc
//
//	@Summary	Replace the caller's showcased favorite reviews (0-3, ordered, #1 first) - reviews must be the caller's own
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		body	body		setFavoritesRequest	true	"ordered review ids, at most 3, no duplicates"
//	@Success	200		{object}	FavoriteReviewsResponse
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Failure	404		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/me/favorites [patch]
func (h *Handlers) SetFavoriteReviews(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}

	var req setFavoritesRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if len(req.ReviewIDs) > maxFavoriteReviews {
		BadRequest(w, "at most 3 favorite reviews")
		return
	}
	if len(queries.DedupeStrings(req.ReviewIDs)) != len(req.ReviewIDs) {
		BadRequest(w, "duplicate review id")
		return
	}
	// requireOwnedReview 404s (never 403) on a review that doesn't exist or
	// isn't the caller's own - same existence/ownership contract used to
	// pin a review as a favorite as is used to edit or delete it.
	for _, id := range req.ReviewIDs {
		if _, ok := h.requireOwnedReview(r.Context(), w, id, user.ID); !ok {
			return
		}
	}

	if err := queries.SetFavoriteReviews(r.Context(), h.Pool, user.ID, req.ReviewIDs); err != nil {
		InternalError(w, err)
		return
	}

	reviews, err := queries.GetFavoriteReviews(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(r.Context(), reviews, hydrateOpts{
		IncludeDj: true, IncludeEvent: true, IncludeEngagement: true, CurrentUserID: &user.ID,
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, FavoriteReviewsResponse{Items: dtos})
}
