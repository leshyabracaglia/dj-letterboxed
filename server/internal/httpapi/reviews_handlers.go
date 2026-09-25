package httpapi

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

type createReviewRequest struct {
	DjID          string    `json:"djId"`
	EventID       *string   `json:"eventId"`
	Rating        *int16    `json:"rating"`
	ReviewText    *string   `json:"reviewText"`
	CrowdVibe     *string   `json:"crowdVibe"`
	CrowdVibeNote *string   `json:"crowdVibeNote"`
	SeenAt        string    `json:"seenAt"`
	TaggedUserIDs *[]string `json:"taggedUserIds"`
}

// validateReviewFields checks the review fields shared by create and
// update. Each is optional (nil = "not provided"/"leave unset"), but if
// present must satisfy these constraints.
func validateReviewFields(rating *int16, reviewText, crowdVibeNote, crowdVibe *string) (vibe *db.CrowdVibe, errMsg string) {
	if rating != nil && (*rating < 1 || *rating > 5) {
		return nil, "rating must be 1-5"
	}
	if reviewText != nil && len(*reviewText) > 5000 {
		return nil, "reviewText too long"
	}
	if crowdVibeNote != nil && len(*crowdVibeNote) > 280 {
		return nil, "crowdVibeNote too long"
	}
	if crowdVibe != nil {
		v := db.CrowdVibe(*crowdVibe)
		if !v.Valid() {
			return nil, "invalid crowdVibe"
		}
		vibe = &v
	}
	return vibe, ""
}

func (req createReviewRequest) validate() (seenAt time.Time, vibe *db.CrowdVibe, errMsg string) {
	if req.DjID == "" {
		return time.Time{}, nil, "djId is required"
	}
	t, err := time.Parse(time.RFC3339, req.SeenAt)
	if err != nil {
		return time.Time{}, nil, "seenAt must be an RFC3339 timestamp"
	}
	vibe, errMsg = validateReviewFields(req.Rating, req.ReviewText, req.CrowdVibeNote, req.CrowdVibe)
	if errMsg != "" {
		return time.Time{}, nil, errMsg
	}
	return t, vibe, ""
}

// CreateReview godoc
//
//	@Summary	Log a set: create a review of a DJ (optionally tied to an event)
//	@Tags		reviews
//	@Accept		json
//	@Produce	json
//	@Param		body	body		createReviewRequest	true	"review to create"
//	@Success	200		{object}	db.Review
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews [post]
func (h *Handlers) CreateReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}

	var req createReviewRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	seenAt, vibe, errMsg := req.validate()
	if errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	tx, err := h.Pool.Begin(r.Context())
	if err != nil {
		InternalError(w, err)
		return
	}
	defer tx.Rollback(r.Context())

	review, err := queries.CreateReview(r.Context(), tx, queries.CreateReviewParams{
		UserID: user.ID, DjID: req.DjID, EventID: req.EventID,
		Rating: req.Rating, ReviewText: req.ReviewText,
		CrowdVibe: vibe, CrowdVibeNote: req.CrowdVibeNote, SeenAt: seenAt,
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	if req.TaggedUserIDs != nil {
		if err := queries.SetReviewTags(r.Context(), tx, review.ID, *req.TaggedUserIDs); err != nil {
			InternalError(w, err)
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, review)
}

type updateReviewRequest struct {
	Rating        *int16    `json:"rating"`
	ReviewText    *string   `json:"reviewText"`
	CrowdVibe     *string   `json:"crowdVibe"`
	CrowdVibeNote *string   `json:"crowdVibeNote"`
	SeenAt        *string   `json:"seenAt"`
	TaggedUserIDs *[]string `json:"taggedUserIds"`
}

// requireOwnedReview loads a review and 404s (never 403) if it doesn't
// exist or isn't owned by the caller — existence and ownership must be
// indistinguishable to the caller, per lib/server/routers/reviews.ts.
func (h *Handlers) requireOwnedReview(ctx context.Context, w http.ResponseWriter, id, userID string) (*db.Review, bool) {
	review, err := queries.GetReviewByID(ctx, h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) || (review != nil && review.UserID != userID) {
		NotFound(w)
		return nil, false
	}
	if err != nil {
		InternalError(w, err)
		return nil, false
	}
	return review, true
}

// UpdateReview godoc
//
//	@Summary	Update a review owned by the caller (404, never 403, if not owned/found)
//	@Tags		reviews
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string					true	"review id"
//	@Param		body	body		updateReviewRequest	true	"fields to update"
//	@Success	200		{object}	db.Review
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Failure	404		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id} [patch]
func (h *Handlers) UpdateReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")

	if _, ok := h.requireOwnedReview(r.Context(), w, id, user.ID); !ok {
		return
	}

	var req updateReviewRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	vibe, errMsg := validateReviewFields(req.Rating, req.ReviewText, req.CrowdVibeNote, req.CrowdVibe)
	if errMsg != "" {
		BadRequest(w, errMsg)
		return
	}
	var seenAt *time.Time
	if req.SeenAt != nil {
		t, err := time.Parse(time.RFC3339, *req.SeenAt)
		if err != nil {
			BadRequest(w, "seenAt must be an RFC3339 timestamp")
			return
		}
		seenAt = &t
	}

	tx, err := h.Pool.Begin(r.Context())
	if err != nil {
		InternalError(w, err)
		return
	}
	defer tx.Rollback(r.Context())

	updated, err := queries.UpdateReview(r.Context(), tx, queries.UpdateReviewParams{
		ID: id, Rating: req.Rating, ReviewText: req.ReviewText,
		CrowdVibe: vibe, CrowdVibeNote: req.CrowdVibeNote, SeenAt: seenAt,
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	if req.TaggedUserIDs != nil {
		if err := queries.SetReviewTags(r.Context(), tx, id, *req.TaggedUserIDs); err != nil {
			InternalError(w, err)
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, updated)
}

// DeleteReview godoc
//
//	@Summary	Delete a review owned by the caller (404, never 403, if not owned/found)
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id} [delete]
func (h *Handlers) DeleteReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")

	if _, ok := h.requireOwnedReview(r.Context(), w, id, user.ID); !ok {
		return
	}

	if err := queries.DeleteReview(r.Context(), h.Pool, id); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// GetReviewByID godoc
//
//	@Summary	Get a review with its relations, engagement, and tagged users
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	ReviewDTO
//	@Failure	404	{object}	errorEnvelope
//	@Router		/api/reviews/{id} [get]
func (h *Handlers) GetReviewByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	rev, err := queries.GetReviewByID(r.Context(), h.Pool, id)
	review, ok := fetchOr404(w, rev, err)
	if !ok {
		return
	}

	currentUserID := optionalUserID(r)

	dtos, err := h.hydrateReviews(r.Context(), []db.Review{*review}, hydrateOpts{
		IncludeUser: true, IncludeDj: true, IncludeEvent: true,
		IncludeEngagement: true, CurrentUserID: currentUserID,
	})
	if err != nil {
		InternalError(w, err)
		return
	}
	dto := dtos[0]

	taggedUsers, err := queries.GetTaggedUsers(r.Context(), h.Pool, id)
	if err != nil {
		InternalError(w, err)
		return
	}
	dto.TaggedUsers = orEmpty(taggedUsers)

	WriteJSON(w, http.StatusOK, dto)
}

// ListReviewsByUser godoc
//
//	@Summary	List a user's reviews, cursor-paginated by seenAt desc
//	@Tags		reviews
//	@Produce	json
//	@Param		username	path		string	true	"username"
//	@Param		cursor		query		string	false	"pagination cursor (RFC3339 seenAt of the last item)"
//	@Param		limit		query		int		false	"page size, 1-50, default 20"
//	@Success	200			{object}	PaginatedReviews
//	@Failure	404			{object}	errorEnvelope
//	@Router		/api/users/{username}/reviews [get]
func (h *Handlers) ListReviewsByUser(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")

	u, err := queries.GetUserByUsername(r.Context(), h.Pool, username)
	user, ok := fetchOr404(w, u, err)
	if !ok {
		return
	}

	limit := queryLimit(r, 20, 50)
	cursor := queryTimeCursor(r, "cursor")

	reviews, err := queries.ListReviewsByUser(r.Context(), h.Pool, user.ID, cursor, limit)
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

	WriteJSON(w, http.StatusOK, PaginatedReviews{Items: dtos, NextCursor: nextSeenAtCursor(reviews, limit)})
}

// LikeReview godoc
//
//	@Summary	Like a review
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id}/like [post]
func (h *Handlers) LikeReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")

	if err := queries.LikeReview(r.Context(), h.Pool, id, user.ID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// UnlikeReview godoc
//
//	@Summary	Unlike a review
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id}/like [delete]
func (h *Handlers) UnlikeReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")

	if err := queries.UnlikeReview(r.Context(), h.Pool, id, user.ID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// ListComments godoc
//
//	@Summary	List a review's comments, oldest first
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path	string	true	"review id"
//	@Success	200	{array}	db.ReviewComment
//	@Router		/api/reviews/{id}/comments [get]
func (h *Handlers) ListComments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	comments, err := queries.ListComments(r.Context(), h.Pool, id)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(comments))
}

type addCommentRequest struct {
	Body string `json:"body"`
}

// AddComment godoc
//
//	@Summary	Add a comment to a review
//	@Tags		reviews
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string				true	"review id"
//	@Param		body	body		addCommentRequest	true	"comment body"
//	@Success	200		{object}	db.ReviewComment
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id}/comments [post]
func (h *Handlers) AddComment(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	reviewID := chi.URLParam(r, "id")

	var req addCommentRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if req.Body == "" || len(req.Body) > 500 {
		BadRequest(w, "body must be 1-500 characters")
		return
	}

	comment, err := queries.AddComment(r.Context(), h.Pool, reviewID, user.ID, req.Body)
	if err != nil {
		InternalError(w, err)
		return
	}
	// Attach the caller's own row directly, avoiding an extra query
	// (mirrors reviews.ts's addComment response shape).
	comment.User = user

	WriteJSON(w, http.StatusOK, comment)
}

// DeleteComment godoc
//
//	@Summary	Delete a comment owned by the caller (404, never 403, if not owned/found)
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"comment id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/comments/{id} [delete]
//
// requireOwnedComment loads a comment and 404s (never 403) if it doesn't
// exist or isn't owned by the caller — same existence/ownership contract as
// requireOwnedReview.
func (h *Handlers) requireOwnedComment(ctx context.Context, w http.ResponseWriter, id, userID string) (*db.ReviewComment, bool) {
	comment, err := queries.GetCommentByID(ctx, h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) || (comment != nil && comment.UserID != userID) {
		NotFound(w)
		return nil, false
	}
	if err != nil {
		InternalError(w, err)
		return nil, false
	}
	return comment, true
}

func (h *Handlers) DeleteComment(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")

	if _, ok := h.requireOwnedComment(r.Context(), w, id, user.ID); !ok {
		return
	}

	if err := queries.DeleteComment(r.Context(), h.Pool, id); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}
