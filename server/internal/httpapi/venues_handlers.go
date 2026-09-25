package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db/queries"
)

// SearchVenues godoc
//
//	@Summary	Search venues by name (derived from events.venue, grouped)
//	@Tags		venues
//	@Produce	json
//	@Param		q	query	string	true	"search query"
//	@Success	200	{array}	queries.VenueSummary
//	@Router		/api/venues/search [get]
func (h *Handlers) SearchVenues(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
		return
	}
	venues, err := queries.SearchVenues(r.Context(), h.Pool, q)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(venues))
}

// GetVenueByName godoc
//
//	@Summary	Get a venue by exact name, with its events
//	@Tags		venues
//	@Produce	json
//	@Param		venue	path		string	true	"venue name"
//	@Success	200		{object}	VenueDetailResponse
//	@Failure	404		{object}	errorEnvelope
//	@Router		/api/venues/{venue} [get]
func (h *Handlers) GetVenueByName(w http.ResponseWriter, r *http.Request) {
	venue := chi.URLParam(r, "venue")

	summary, err := queries.GetVenueSummary(r.Context(), h.Pool, venue)
	if err != nil {
		InternalError(w, err)
		return
	}
	if summary == nil {
		NotFound(w)
		return
	}

	events, err := queries.ListEventsByVenue(r.Context(), h.Pool, venue)
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, VenueDetailResponse{
		Venue:      summary.Venue,
		City:       summary.City,
		EventCount: summary.EventCount,
		Events:     orEmpty(events),
	})
}
