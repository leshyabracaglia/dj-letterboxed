package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db/queries"
)

func (h *Handlers) SearchEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		BadRequest(w, "q is required")
		return
	}
	events, err := queries.SearchEvents(r.Context(), h.Pool, q)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, events)
}

func (h *Handlers) GetEventByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	event, err := queries.GetEventByID(r.Context(), h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	logs, err := queries.ListReviewsByEvent(r.Context(), h.Pool, event.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(r.Context(), logs, hydrateOpts{IncludeUser: true, IncludeDj: true})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"event": event, "logs": dtos})
}

type createEventRequest struct {
	Name        string  `json:"name"`
	Venue       string  `json:"venue"`
	City        *string `json:"city"`
	EventDate   string  `json:"eventDate"`
	Description *string `json:"description"`
}

func (h *Handlers) CreateEvent(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	var req createEventRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || len(req.Name) > 160 || req.Venue == "" || len(req.Venue) > 160 {
		BadRequest(w, "name and venue are required (max 160 chars)")
		return
	}
	eventDate, err := time.Parse(time.RFC3339, req.EventDate)
	if err != nil {
		BadRequest(w, "eventDate must be an RFC3339 timestamp")
		return
	}

	existing, err := queries.GetEventByExactMatch(r.Context(), h.Pool, req.Name, req.Venue, eventDate)
	if err != nil && !errors.Is(err, queries.ErrNotFound) {
		InternalError(w, err)
		return
	}
	if existing != nil {
		WriteJSON(w, http.StatusOK, existing)
		return
	}

	event, err := queries.CreateEvent(r.Context(), h.Pool, req.Name, req.Venue, req.City, eventDate, req.Description, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, event)
}
