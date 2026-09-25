package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

// Referenced only by swag doc comments below (@Success/@Param types) -
// keeps the import resolvable for OpenAPI generation without an unused
// import error.
var _ db.Event

// SearchEvents godoc
//
//	@Summary	Search events by name
//	@Tags		events
//	@Produce	json
//	@Param		q	query	string	true	"search query"
//	@Success	200	{array}	db.Event
//	@Router		/api/events/search [get]
func (h *Handlers) SearchEvents(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
		return
	}
	events, err := queries.SearchEvents(r.Context(), h.Pool, q)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, events)
}

// GetEventByID godoc
//
//	@Summary	Get an event by id, with all its reviews
//	@Tags		events
//	@Produce	json
//	@Param		id	path		string	true	"event id"
//	@Success	200	{object}	EventDetailResponse
//	@Failure	404	{object}	errorEnvelope
//	@Router		/api/events/{id} [get]
func (h *Handlers) GetEventByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	ev, err := queries.GetEventByID(r.Context(), h.Pool, id)
	event, ok := fetchOr404(w, ev, err)
	if !ok {
		return
	}

	reviews, err := queries.ListReviewsByEvent(r.Context(), h.Pool, event.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(r.Context(), reviews, hydrateOpts{IncludeUser: true, IncludeDj: true})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, EventDetailResponse{Event: *event, Reviews: dtos})
}

type createEventRequest struct {
	Name        string  `json:"name"`
	Venue       string  `json:"venue"`
	City        *string `json:"city"`
	EventDate   string  `json:"eventDate"`
	Description *string `json:"description"`
}

// CreateEvent godoc
//
//	@Summary	Create an event (or return the existing one, deduped by exact name+venue+date)
//	@Tags		events
//	@Accept		json
//	@Produce	json
//	@Param		body	body		createEventRequest	true	"event to create"
//	@Success	200		{object}	db.Event
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/events [post]
func (h *Handlers) CreateEvent(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
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
