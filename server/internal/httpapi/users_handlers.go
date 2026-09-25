package httpapi

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

var usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,32}$`)

// Referenced only by swag doc comments below (@Success/@Param types) -
// keeps the import resolvable for OpenAPI generation without an unused
// import error.
var _ db.User

// Me godoc
//
//	@Summary	Get the caller's own user row
//	@Tags		users
//	@Produce	json
//	@Success	200	{object}	db.User
//	@Failure	401	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/me [get]
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	WriteJSON(w, http.StatusOK, user)
}

// SearchUsers godoc
//
//	@Summary	Search users by username or display name
//	@Tags		users
//	@Produce	json
//	@Param		q	query	string	true	"search query"
//	@Success	200	{array}	db.User
//	@Router		/api/users/search [get]
func (h *Handlers) SearchUsers(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
		return
	}
	users, err := queries.SearchUsers(r.Context(), h.Pool, q)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, users)
}

// GetUserByUsername godoc
//
//	@Summary	Get a user's profile by username, with follow/review counts
//	@Tags		users
//	@Produce	json
//	@Param		username	path		string	true	"username"
//	@Success	200			{object}	UserProfileResponse
//	@Failure	404			{object}	errorEnvelope
//	@Router		/api/users/{username} [get]
func (h *Handlers) GetUserByUsername(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")

	u, err := queries.GetUserByUsername(r.Context(), h.Pool, username)
	user, ok := fetchOr404(w, u, err)
	if !ok {
		return
	}

	reviewCount, err := queries.CountReviewsByUser(r.Context(), h.Pool, user.ID)
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

	WriteJSON(w, http.StatusOK, UserProfileResponse{
		User:           *user,
		ReviewCount:    reviewCount,
		FollowerCount:  followerCount,
		FollowingCount: followingCount,
	})
}

// GetUserStats godoc
//
//	@Summary	Get a user's review stats: totals, top DJs, top venues
//	@Tags		users
//	@Produce	json
//	@Param		username	path		string	true	"username"
//	@Success	200			{object}	UserStatsResponse
//	@Failure	404			{object}	errorEnvelope
//	@Router		/api/users/{username}/stats [get]
func (h *Handlers) GetUserStats(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")

	u, err := queries.GetUserByUsername(r.Context(), h.Pool, username)
	user, ok := fetchOr404(w, u, err)
	if !ok {
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

	WriteJSON(w, http.StatusOK, UserStatsResponse{
		TotalReviews: totals.TotalReviews,
		UniqueDjs:    totals.UniqueDjs,
		TopDjs:       orEmpty(topDjs),
		TopVenues:    orEmpty(topVenues),
	})
}

// GetLeaderboard godoc
//
//	@Summary	Leaderboard scoped to the caller and everyone they follow
//	@Tags		users
//	@Produce	json
//	@Success	200	{array}	queries.LeaderboardEntry
//	@Failure	401	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/leaderboard [get]
func (h *Handlers) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
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
	WriteJSON(w, http.StatusOK, orEmpty(entries))
}

type updateProfileRequest struct {
	Username    *string `json:"username"`
	DisplayName *string `json:"displayName"`
	Bio         *string `json:"bio"`
	AvatarURL   *string `json:"avatarUrl"`
}

// UpdateProfile godoc
//
//	@Summary	Update the caller's own profile
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		body	body		updateProfileRequest	true	"fields to update"
//	@Success	200		{object}	db.User
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Failure	409		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/me [patch]
func (h *Handlers) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}

	var req updateProfileRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if req.Username != nil && !usernameRe.MatchString(*req.Username) {
		BadRequest(w, "username must be 3-32 characters: lowercase letters, numbers, underscores")
		return
	}

	updated, err := queries.UpdateUserProfile(r.Context(), h.Pool, user.ID, req.Username, req.DisplayName, req.Bio, req.AvatarURL)
	if err != nil {
		if errors.Is(err, queries.ErrUsernameTaken) {
			WriteError(w, http.StatusConflict, "USERNAME_TAKEN", "that username is already taken")
			return
		}
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, updated)
}

// Follow godoc
//
//	@Summary	Follow a user
//	@Tags		follows
//	@Produce	json
//	@Param		userId	path		string	true	"user id to follow"
//	@Success	200		{object}	SuccessResponse
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/follows/{userId} [post]
func (h *Handlers) Follow(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
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
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// Unfollow godoc
//
//	@Summary	Unfollow a user
//	@Tags		follows
//	@Produce	json
//	@Param		userId	path		string	true	"user id to unfollow"
//	@Success	200		{object}	SuccessResponse
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/follows/{userId} [delete]
func (h *Handlers) Unfollow(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	targetID := chi.URLParam(r, "userId")

	if err := queries.Unfollow(r.Context(), h.Pool, user.ID, targetID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// GetFollowers godoc
//
//	@Summary	List the users who follow the given user
//	@Tags		follows
//	@Produce	json
//	@Param		userId	path	string	true	"user id"
//	@Success	200		{array}	db.User
//	@Router		/api/users/{userId}/followers [get]
func (h *Handlers) GetFollowers(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	followers, err := queries.GetFollowers(r.Context(), h.Pool, userID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, followers)
}

// GetFollowing godoc
//
//	@Summary	List the users the given user follows
//	@Tags		follows
//	@Produce	json
//	@Param		userId	path	string	true	"user id"
//	@Success	200		{array}	db.User
//	@Router		/api/users/{userId}/following [get]
func (h *Handlers) GetFollowing(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")
	following, err := queries.GetFollowing(r.Context(), h.Pool, userID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, following)
}
