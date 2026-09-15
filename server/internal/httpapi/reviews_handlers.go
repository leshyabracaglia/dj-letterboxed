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
	DjID            string    `json:"djId"`
	EventID         *string   `json:"eventId"`
	RatingHalfStars *int16    `json:"ratingHalfStars"`
	ReviewText      *string   `json:"reviewText"`
	CrowdVibe       *string   `json:"crowdVibe"`
	CrowdVibeNote   *string   `json:"crowdVibeNote"`
	SeenAt          string    `json:"seenAt"`
	TaggedUserIDs   *[]string `json:"taggedUserIds"`
}

func (req createReviewRequest) validate() (seenAt time.Time, vibe *db.CrowdVibe, errMsg string) {
	if req.DjID == "" {
		return time.Time{}, nil, "djId is required"
	}
	t, err := time.Parse(time.RFC3339, req.SeenAt)
	if err != nil {
		return time.Time{}, nil, "seenAt must be an RFC3339 timestamp"
	}
	if req.RatingHalfStars != nil && (*req.RatingHalfStars < 1 || *req.RatingHalfStars > 10) {
		return time.Time{}, nil, "ratingHalfStars must be 1-10"
	}
	if req.ReviewText != nil && len(*req.ReviewText) > 5000 {
		return time.Time{}, nil, "reviewText too long"
	}
	if req.CrowdVibeNote != nil && len(*req.CrowdVibeNote) > 280 {
		return time.Time{}, nil, "crowdVibeNote too long"
	}
	if req.CrowdVibe != nil {
		v := db.CrowdVibe(*req.CrowdVibe)
		if !v.Valid() {
			return time.Time{}, nil, "invalid crowdVibe"
		}
		vibe = &v
	}
	return t, vibe, ""
}

func (h *Handlers) CreateReview(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
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
		RatingHalfStars: req.RatingHalfStars, ReviewText: req.ReviewText,
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
	RatingHalfStars *int16    `json:"ratingHalfStars"`
	ReviewText      *string   `json:"reviewText"`
	CrowdVibe       *string   `json:"crowdVibe"`
	CrowdVibeNote   *string   `json:"crowdVibeNote"`
	SeenAt          *string   `json:"seenAt"`
	TaggedUserIDs   *[]string `json:"taggedUserIds"`
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

func (h *Handlers) UpdateReview(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
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
	if req.RatingHalfStars != nil && (*req.RatingHalfStars < 1 || *req.RatingHalfStars > 10) {
		BadRequest(w, "ratingHalfStars must be 1-10")
		return
	}
	if req.ReviewText != nil && len(*req.ReviewText) > 5000 {
		BadRequest(w, "reviewText too long")
		return
	}
	if req.CrowdVibeNote != nil && len(*req.CrowdVibeNote) > 280 {
		BadRequest(w, "crowdVibeNote too long")
		return
	}
	var vibe *db.CrowdVibe
	if req.CrowdVibe != nil {
		v := db.CrowdVibe(*req.CrowdVibe)
		if !v.Valid() {
			BadRequest(w, "invalid crowdVibe")
			return
		}
		vibe = &v
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
		ID: id, RatingHalfStars: req.RatingHalfStars, ReviewText: req.ReviewText,
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

func (h *Handlers) DeleteReview(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
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
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handlers) GetReviewByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	review, err := queries.GetReviewByID(r.Context(), h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	var currentUserID *string
	if user, ok := UserFromContext(r.Context()); ok {
		currentUserID = &user.ID
	}

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
	dto.TaggedUsers = taggedUsers

	WriteJSON(w, http.StatusOK, dto)
}

func (h *Handlers) ListReviewsByUser(w http.ResponseWriter, r *http.Request) {
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

	limit := queryLimit(r, 20, 50)
	cursor := queryTimeCursor(r, "cursor")

	reviews, err := queries.ListReviewsByUser(r.Context(), h.Pool, user.ID, cursor, limit)
	if err != nil {
		InternalError(w, err)
		return
	}

	var currentUserID *string
	if caller, ok := UserFromContext(r.Context()); ok {
		currentUserID = &caller.ID
	}

	dtos, err := h.hydrateReviews(r.Context(), reviews, hydrateOpts{
		IncludeDj: true, IncludeEvent: true, IncludeEngagement: true, CurrentUserID: currentUserID,
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	var nextCursor *string
	if len(reviews) == limit {
		s := reviews[len(reviews)-1].SeenAt.Format(rfc3339)
		nextCursor = &s
	}

	WriteJSON(w, http.StatusOK, map[string]any{"items": dtos, "nextCursor": nextCursor})
}

func (h *Handlers) LikeReview(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")

	if err := queries.LikeReview(r.Context(), h.Pool, id, user.ID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handlers) UnlikeReview(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")

	if err := queries.UnlikeReview(r.Context(), h.Pool, id, user.ID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handlers) ListComments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	comments, err := queries.ListComments(r.Context(), h.Pool, id)
	if err != nil {
		InternalError(w, err)
		return
	}
	if comments == nil {
		comments = []db.ReviewComment{}
	}
	WriteJSON(w, http.StatusOK, comments)
}

type addCommentRequest struct {
	Body string `json:"body"`
}

func (h *Handlers) AddComment(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
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

func (h *Handlers) DeleteComment(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	id := chi.URLParam(r, "id")

	comment, err := queries.GetCommentByID(r.Context(), h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) || (comment != nil && comment.UserID != user.ID) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	if err := queries.DeleteComment(r.Context(), h.Pool, id); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}
