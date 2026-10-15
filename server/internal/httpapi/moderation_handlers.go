package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

func blockedError(w http.ResponseWriter) {
	WriteError(w, http.StatusForbidden, "BLOCKED", "you can't interact with this user")
}

// hiddenUsers returns who's hidden from the caller (see
// queries.HiddenUserIDs); nobody when signed out.
func (h *Handlers) hiddenUsers(ctx context.Context, userID *string) (map[string]bool, error) {
	if userID == nil {
		return nil, nil
	}
	return queries.HiddenUserIDs(ctx, h.Pool, *userID)
}

// withoutHidden drops the reviews of hidden users. Callers paginate on the
// unfiltered list, so a page may come back short but the cursor still moves.
func withoutHidden(reviews []db.Review, hidden map[string]bool) []db.Review {
	if len(hidden) == 0 {
		return reviews
	}
	out := make([]db.Review, 0, len(reviews))
	for _, r := range reviews {
		if !hidden[r.UserID] {
			out = append(out, r)
		}
	}
	return out
}

// blockedWith writes a 403 and reports true if the caller and otherID have
// blocked each other either way.
func (h *Handlers) blockedWith(ctx context.Context, w http.ResponseWriter, userID, otherID string) bool {
	blocked, err := queries.IsBlockedEitherWay(ctx, h.Pool, userID, otherID)
	if err != nil {
		InternalError(w, err)
		return true
	}
	if blocked {
		blockedError(w)
	}
	return blocked
}

// BlockUser godoc
//
//	@Summary	Block a user: hides each of you from the other and unfollows both ways
//	@Tags		moderation
//	@Produce	json
//	@Param		userId	path		string	true	"user id to block"
//	@Success	200		{object}	SuccessResponse
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Failure	404		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/{userId}/block [post]
func (h *Handlers) BlockUser(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	targetID := chi.URLParam(r, "userId")
	if targetID == user.ID {
		BadRequest(w, "cannot block yourself")
		return
	}
	if !uuidPattern.MatchString(targetID) {
		NotFound(w)
		return
	}
	target, err := queries.GetUserByID(r.Context(), h.Pool, targetID)
	if _, ok := fetchOr404(w, target, err); !ok {
		return
	}

	if err := queries.Block(r.Context(), h.Pool, user.ID, targetID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// UnblockUser godoc
//
//	@Summary	Unblock a user
//	@Tags		moderation
//	@Produce	json
//	@Param		userId	path		string	true	"user id to unblock"
//	@Success	200		{object}	SuccessResponse
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/{userId}/block [delete]
func (h *Handlers) UnblockUser(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	targetID := chi.URLParam(r, "userId")
	if !uuidPattern.MatchString(targetID) {
		NotFound(w)
		return
	}

	if err := queries.Unblock(r.Context(), h.Pool, user.ID, targetID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// ListBlockedUsers godoc
//
//	@Summary	List the users the caller has blocked, most recent first
//	@Tags		moderation
//	@Produce	json
//	@Success	200	{array}		db.User
//	@Failure	401	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/me/blocks [get]
func (h *Handlers) ListBlockedUsers(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	users, err := queries.ListBlockedUsers(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(users))
}

var reportReasons = map[string]bool{
	"spam":       true,
	"harassment": true,
	"hate":       true,
	"sexual":     true,
	"violence":   true,
	"other":      true,
}

// One of reviewId, commentId or userId says what's reported.
type createReportRequest struct {
	ReviewID  *string `json:"reviewId,omitempty"`
	CommentID *string `json:"commentId,omitempty"`
	UserID    *string `json:"userId,omitempty"`
	// spam, harassment, hate, sexual, violence or other.
	Reason string `json:"reason"`
}

// CreateReport godoc
//
//	@Summary	Report a review, comment or user for moderation
//	@Tags		moderation
//	@Accept		json
//	@Produce	json
//	@Param		body	body		createReportRequest	true	"what's reported, and why"
//	@Success	200		{object}	SuccessResponse
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Failure	404		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reports [post]
func (h *Handlers) CreateReport(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req createReportRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if !reportReasons[req.Reason] {
		BadRequest(w, "unknown reason")
		return
	}

	ctx := r.Context()
	p := queries.CreateReportParams{ReporterID: user.ID, Reason: req.Reason}
	// The review page the reported content is on, if any.
	var onReviewID string
	var err error
	switch {
	case req.CommentID != nil && uuidPattern.MatchString(*req.CommentID):
		var c *db.ReviewComment
		if c, err = queries.GetCommentByID(ctx, h.Pool, *req.CommentID); err == nil {
			p.CommentID, p.ReportedUserID, p.Content = &c.ID, c.UserID, &c.Body
			onReviewID = c.ReviewID
		}
	case req.ReviewID != nil && uuidPattern.MatchString(*req.ReviewID):
		var rv *db.Review
		if rv, err = queries.GetReviewByID(ctx, h.Pool, *req.ReviewID); err == nil {
			p.ReviewID, p.ReportedUserID, p.Content = &rv.ID, rv.UserID, rv.ReviewText
			onReviewID = rv.ID
		}
	case req.UserID != nil && uuidPattern.MatchString(*req.UserID):
		var u *db.User
		if u, err = queries.GetUserByID(ctx, h.Pool, *req.UserID); err == nil {
			p.ReportedUserID, p.Content = u.ID, u.Bio
		}
	default:
		BadRequest(w, "reviewId, commentId or userId is required")
		return
	}
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	if p.ReportedUserID == user.ID {
		BadRequest(w, "cannot report yourself")
		return
	}

	id, err := queries.CreateReport(ctx, h.Pool, p)
	if err != nil {
		InternalError(w, err)
		return
	}
	// Reports need a look within 24 hours; this is the line to alert on.
	slog.Warn("content reported", "reportId", id, "reason", p.Reason, "reportedUserId", p.ReportedUserID)
	h.emailReport(id, user, p, onReviewID)
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// emailReport sends the report to the owner's inbox, in the background like
// push notifications: a failed email is logged, never the report's failure.
func (h *Handlers) emailReport(reportID string, reporter *db.User, p queries.CreateReportParams, onReviewID string) {
	if h.Email == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
		defer cancel()

		reported, err := queries.GetUserByID(ctx, h.Pool, p.ReportedUserID)
		if err != nil {
			slog.Error("report email failed", "reportId", reportID, "error", err)
			return
		}
		kind := "user"
		switch {
		case p.CommentID != nil:
			kind = "comment"
		case p.ReviewID != nil:
			kind = "review"
		}
		content := "(none)"
		if p.Content != nil && *p.Content != "" {
			content = *p.Content
		}

		var b strings.Builder
		fmt.Fprintf(&b, "A %s was reported for %s.\n\n", kind, p.Reason)
		fmt.Fprintf(&b, "Reported user: @%s (%s/user/%s, id %s)\n", reported.Username, h.WebURL, reported.Username, reported.ID)
		fmt.Fprintf(&b, "Reported by: @%s (id %s)\n", reporter.Username, reporter.ID)
		if onReviewID != "" {
			fmt.Fprintf(&b, "Where: %s/review/%s\n", h.WebURL, onReviewID)
		}
		if p.CommentID != nil {
			fmt.Fprintf(&b, "Comment id: %s\n", *p.CommentID)
		}
		if p.ReviewID != nil {
			fmt.Fprintf(&b, "Review id: %s\n", *p.ReviewID)
		}
		fmt.Fprintf(&b, "\nReported text:\n%s\n\nReport id: %s\nApple expects reports to be acted on within 24 hours.\n", content, reportID)

		subject := fmt.Sprintf("Beatboxd report: %s by @%s (%s)", kind, reported.Username, p.Reason)
		if err := h.Email.Send(ctx, subject, b.String()); err != nil {
			slog.Error("report email failed", "reportId", reportID, "error", err)
		}
	}()
}
