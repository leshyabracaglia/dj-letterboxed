package httpapi

import (
	"net/http"

	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

type NotificationsResponse struct {
	Items      []queries.Notification `json:"items"`
	NextCursor *string                `json:"nextCursor"`
}

type UnreadNotificationsResponse struct {
	Count int `json:"count"`
}

// ListNotifications godoc
//
//	@Summary	The caller's notifications (follows, likes, comments, being tagged), newest first
//	@Tags		notifications
//	@Produce	json
//	@Param		cursor	query		string	false	"pagination cursor (opaque, encodes the last item's createdAt)"
//	@Param		limit	query		int		false	"page size, 1-50, default 30"
//	@Success	200		{object}	NotificationsResponse
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/notifications [get]
func (h *Handlers) ListNotifications(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	limit := queryLimit(r, 30, 50)
	cursor := domain.DecodeCursor(r.URL.Query().Get("cursor"))

	items, err := queries.ListNotifications(r.Context(), h.Pool, user.ID, cursor.CreatedAt, limit)
	if err != nil {
		InternalError(w, err)
		return
	}
	var nextCursor *string
	if len(items) >= limit {
		enc := domain.EncodeCursor(domain.Cursor{CreatedAt: &items[len(items)-1].CreatedAt})
		nextCursor = &enc
	}
	WriteJSON(w, http.StatusOK, NotificationsResponse{Items: items, NextCursor: nextCursor})
}

// CountUnreadNotifications godoc
//
//	@Summary	How many of the caller's notifications came in since they last marked them seen
//	@Tags		notifications
//	@Produce	json
//	@Success	200	{object}	UnreadNotificationsResponse
//	@Failure	401	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/notifications/unread-count [get]
func (h *Handlers) CountUnreadNotifications(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	count, err := queries.CountUnreadNotifications(r.Context(), h.Pool, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, UnreadNotificationsResponse{Count: count})
}

// MarkNotificationsSeen godoc
//
//	@Summary	Mark all of the caller's notifications read
//	@Tags		notifications
//	@Produce	json
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/notifications/seen [post]
func (h *Handlers) MarkNotificationsSeen(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	if err := queries.MarkNotificationsSeen(r.Context(), h.Pool, user.ID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}
