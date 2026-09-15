package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db/queries"
)

func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	WriteJSON(w, http.StatusOK, user)
}

func (h *Handlers) SearchUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		BadRequest(w, "q is required")
		return
	}
	users, err := queries.SearchUsers(r.Context(), h.Pool, q)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, users)
}

func (h *Handlers) GetUserByUsername(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")

	user, err := queries.GetUserByUsername(r.Context(), h.Pool, username)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	logCount, err := queries.CountReviewsByUser(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	followerCount, err := queries.CountFollowers(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	followingCount, err := queries.CountFollowing(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"user":           user,
		"logCount":       logCount,
		"followerCount":  followerCount,
		"followingCount": followingCount,
	})
}

func (h *Handlers) GetUserStats(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")

	user, err := queries.GetUserByUsername(r.Context(), h.Pool, username)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	totals, err := queries.GetUserTotals(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	topDjs, err := queries.GetTopDjsForUser(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	topVenues, err := queries.GetTopVenuesForUser(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"totalLogs": totals.TotalLogs,
		"uniqueDjs": totals.UniqueDjs,
		"topDjs":    orEmptyTopDjs(topDjs),
		"topVenues": orEmptyTopVenues(topVenues),
	})
}

func orEmptyTopDjs(in []queries.TopDj) []queries.TopDj {
	if in == nil {
		return []queries.TopDj{}
	}
	return in
}

func orEmptyTopVenues(in []queries.TopVenue) []queries.TopVenue {
	if in == nil {
		return []queries.TopVenue{}
	}
	return in
}

func (h *Handlers) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	followingIDs, err := queries.GetFollowingIDs(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	ids := append([]string{user.ID}, followingIDs...)

	entries, err := queries.GetLeaderboard(r.Context(), h.Pool, ids)
	if err != nil {
		InternalError(w, err)
		return
	}
	if entries == nil {
		entries = []queries.LeaderboardEntry{}
	}
	WriteJSON(w, http.StatusOK, entries)
}

type updateProfileRequest struct {
	DisplayName *string `json:"displayName"`
	Bio         *string `json:"bio"`
	AvatarURL   *string `json:"avatarUrl"`
}

func (h *Handlers) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	var req updateProfileRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	updated, err := queries.UpdateUserProfile(r.Context(), h.Pool, user.ID, req.DisplayName, req.Bio, req.AvatarURL)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, updated)
}

func (h *Handlers) Follow(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	targetID := chi.URLParam(r, "userId")
	if targetID == user.ID {
		BadRequest(w, "cannot follow yourself")
		return
	}

	if err := queries.Follow(r.Context(), h.Pool, user.ID, targetID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handlers) Unfollow(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	targetID := chi.URLParam(r, "userId")

	if err := queries.Unfollow(r.Context(), h.Pool, user.ID, targetID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handlers) GetFollowers(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	followers, err := queries.GetFollowers(r.Context(), h.Pool, userID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, followers)
}

func (h *Handlers) GetFollowing(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	following, err := queries.GetFollowing(r.Context(), h.Pool, userID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, following)
}
