package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
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
//	@Summary	Get a night by id, with its series, lineup, and all its reviews
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

	var series *db.EventSeries
	if event.SeriesID != nil {
		series, err = queries.GetSeriesByID(r.Context(), h.Pool, *event.SeriesID)
		if err != nil {
			InternalError(w, err)
			return
		}
	}
	lineup, err := queries.ListLineup(r.Context(), h.Pool, event.ID)
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, EventDetailResponse{Event: *event, Series: series, Lineup: orEmpty(lineup), Reviews: dtos})
}

// The venue is given one of three ways, checked in this order: venueId (a
// saved venue), placeId (a Google Places result, saved as a venue on first
// use - pass the autocomplete session token with it), or venue (a typed-in
// name).
type createEventRequest struct {
	Name              string  `json:"name"`
	Venue             string  `json:"venue"`
	VenueID           *string `json:"venueId"`
	PlaceID           *string `json:"placeId"`
	PlaceSessionToken *string `json:"placeSessionToken"`
	City              *string `json:"city"`
	EventDate         string  `json:"eventDate"`
	Description       *string `json:"description"`
}

// CreateEvent godoc
//
//	@Summary	Create an event (or return the existing one, deduped by exact name+venue+date)
//	@Description	The venue is resolved from venueId, then placeId (a Google Places id, saved as a venue on first use), then the typed venue name.
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
	if req.Name == "" || len(req.Name) > 160 {
		BadRequest(w, "name is required (max 160 chars)")
		return
	}
	eventDate, err := time.Parse(time.RFC3339, req.EventDate)
	if err != nil {
		BadRequest(w, "eventDate must be an RFC3339 timestamp")
		return
	}

	venue, err := h.resolveVenue(r.Context(), req, user.ID)
	if err != nil {
		var inputErr errVenueInput
		switch {
		case errors.As(err, &inputErr):
			BadRequest(w, inputErr.msg)
		case errors.Is(err, domain.ErrPlacesNotConfigured):
			WriteError(w, http.StatusServiceUnavailable, "UNAVAILABLE", "place search is not configured")
		default:
			InternalError(w, err)
		}
		return
	}
	city := req.City
	if city == nil || *city == "" {
		city = venue.City
	}

	existing, err := queries.GetEventByExactMatch(r.Context(), h.Pool, req.Name, venue.ID, eventDate)
	if err != nil && !errors.Is(err, queries.ErrNotFound) {
		InternalError(w, err)
		return
	}
	if existing != nil {
		WriteJSON(w, http.StatusOK, existing)
		return
	}

	event, err := queries.CreateEvent(r.Context(), h.Pool, req.Name, nil, venue, city, eventDate, false, true, req.Description, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, event)
}
