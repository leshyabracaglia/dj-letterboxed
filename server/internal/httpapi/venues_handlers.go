package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// SearchVenues godoc
//
//	@Summary	Search saved venues by name, busiest first
//	@Tags		venues
//	@Produce	json
//	@Param		q		query	string	false	"name search; omit for the busiest venues"
//	@Param		limit	query	int		false	"max results, 1-50, default 20"
//	@Success	200		{array}	queries.VenueSummary
//	@Router		/api/venues/search [get]
func (h *Handlers) SearchVenues(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	venues, err := queries.SearchVenues(r.Context(), h.Pool, q, queryLimit(r, 20, 50))
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(venues))
}

// SearchPlaces godoc
//
//	@Summary	Search Google Places for venues not yet saved
//	@Description	Pass the same client-generated sessionToken on every keystroke of one search and on the POST /api/logs that saves the picked place, so Google bills them as one session.
//	@Tags		venues
//	@Produce	json
//	@Param		q				query	string	true	"search query"
//	@Param		sessionToken	query	string	false	"Places autocomplete session token"
//	@Success	200				{array}	domain.PlaceSuggestion
//	@Failure	401				{object}	errorEnvelope
//	@Failure	503				{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/venues/places-search [get]
func (h *Handlers) SearchPlaces(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
		return
	}
	suggestions, err := h.Places.Autocomplete(r.Context(), q, r.URL.Query().Get("sessionToken"))
	if err != nil {
		if errors.Is(err, domain.ErrPlacesNotConfigured) {
			WriteError(w, http.StatusServiceUnavailable, "UNAVAILABLE", "place search is not configured")
			return
		}
		slog.Error("places autocomplete failed", "error", err)
		WriteError(w, http.StatusBadGateway, "UPSTREAM_ERROR", "place search failed")
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(suggestions))
}

// GetVenueByID godoc
//
//	@Summary	Get a venue by id, with the events logged there and recent reviews
//	@Tags		venues
//	@Produce	json
//	@Param		id	path		string	true	"venue id"
//	@Success	200	{object}	VenueDetailResponse
//	@Failure	404	{object}	errorEnvelope
//	@Router		/api/venues/{id} [get]
func (h *Handlers) GetVenueByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(id) {
		NotFound(w)
		return
	}

	s, err := queries.GetVenueSummary(r.Context(), h.Pool, id)
	summary, ok := fetchOr404(w, s, err)
	if !ok {
		return
	}

	events, err := queries.ListVenueEvents(r.Context(), h.Pool, id)
	if err != nil {
		InternalError(w, err)
		return
	}
	reviews, err := queries.ListReviewsByVenue(r.Context(), h.Pool, id, 30)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(r.Context(), reviews, hydrateOpts{
		IncludeUser: true, IncludeDj: true, IncludeLog: true,
		IncludeEngagement: true, CurrentUserID: optionalUserID(r),
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, VenueDetailResponse{
		Venue:         *summary,
		Events:        orEmpty(events),
		RecentReviews: dtos,
	})
}

// errVenueInput is a resolveVenue failure caused by the request (unknown
// venue id, bad place id), reported as a 400 rather than a 500.
type errVenueInput struct{ msg string }

func (e errVenueInput) Error() string { return e.msg }

// venueInput is how a request names a venue, checked in this order: venueId
// (a saved venue), placeId (a Google Places result, saved as a venue on
// first use - pass the autocomplete session token with it), or venue (a
// typed-in name).
type venueInput struct {
	Venue             string
	VenueID           *string
	PlaceID           *string
	PlaceSessionToken *string
	City              *string
}

// resolveVenue turns venueInput into a saved venue: an existing venue id, a
// Google place (saved on first use), or a typed-in name (matched
// case-insensitively against other typed-in venues).
func (h *Handlers) resolveVenue(ctx context.Context, req venueInput, userID string) (*db.Venue, error) {
	switch {
	case req.VenueID != nil && *req.VenueID != "":
		if !uuidPattern.MatchString(*req.VenueID) {
			return nil, errVenueInput{"unknown venueId"}
		}
		v, err := queries.GetVenueByID(ctx, h.Pool, *req.VenueID)
		if errors.Is(err, queries.ErrNotFound) {
			return nil, errVenueInput{"unknown venueId"}
		}
		return v, err

	case req.PlaceID != nil && *req.PlaceID != "":
		v, err := queries.GetVenueByPlaceID(ctx, h.Pool, *req.PlaceID)
		if err == nil || !errors.Is(err, queries.ErrNotFound) {
			return v, err
		}
		sessionToken := ""
		if req.PlaceSessionToken != nil {
			sessionToken = *req.PlaceSessionToken
		}
		place, err := h.Places.Details(ctx, *req.PlaceID, sessionToken)
		if err != nil {
			if errors.Is(err, domain.ErrPlacesNotConfigured) {
				return nil, err
			}
			slog.Error("places details failed", "placeId", *req.PlaceID, "error", err)
			return nil, errVenueInput{"could not look up that place"}
		}
		return queries.UpsertPlaceVenue(ctx, h.Pool, queries.CreatePlaceVenueParams{
			GooglePlaceID:   place.PlaceID,
			Name:            truncateRunes(place.Name, 160),
			City:            place.City,
			Address:         place.Address,
			Latitude:        place.Latitude,
			Longitude:       place.Longitude,
			CreatedByUserID: userID,
		})

	default:
		name := strings.TrimSpace(req.Venue)
		if name == "" || len(name) > 160 {
			return nil, errVenueInput{"venue, venueId or placeId is required (venue max 160 chars)"}
		}
		return queries.UpsertUnlinkedVenue(ctx, h.Pool, name, req.City, userID)
	}
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}
