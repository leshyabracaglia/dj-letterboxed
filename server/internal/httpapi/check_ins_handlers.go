package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// A second check-in at the same venue within this long is the same night.
const checkInRepeatWindow = 12 * time.Hour

// How far around the caller the check-in prompt looks for venues, and how
// many it offers.
const (
	nearbyVenuesRadiusM = domain.CheckInMaxRadiusM
	nearbyVenuesLimit   = 5
)

// NearbyVenue is a venue the caller could check in at: a saved venue (id
// set), or a Google place not on Beatboxd yet (only placeId set; checking
// in there saves it).
type NearbyVenue struct {
	ID        *string `json:"id" extensions:"x-nullable"`
	PlaceID   *string `json:"placeId" extensions:"x-nullable"`
	Name      string  `json:"name"`
	City      *string `json:"city" extensions:"x-nullable"`
	DistanceM int     `json:"distanceM"`
}

type NearbyVenuesResponse struct {
	Venues []NearbyVenue `json:"venues"`
}

type checkInRequest struct {
	// One of venueId (a saved venue) or placeId (a Google place from
	// GET /api/check-ins/nearby).
	VenueID   string  `json:"venueId,omitempty"`
	PlaceID   string  `json:"placeId,omitempty"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	// How accurate the device says the fix is, in meters.
	AccuracyM *float64 `json:"accuracyM,omitempty"`
}

type CheckInResponse struct {
	Venue NearbyVenue `json:"venue"`
	// When the caller checked in there (an earlier check-in the same night
	// stands). Logging the venue for that night shows as verified.
	CheckedInAt time.Time `json:"checkedInAt"`
	// FriendsHere are the caller's friends (mutual follows) who checked in
	// at the same venue tonight; they and the caller are each told the
	// other's there.
	FriendsHere []db.User `json:"friendsHere"`
}

// friendsHereWindow is how recently a friend's check-in counts as the same
// night.
const friendsHereWindow = 12 * time.Hour

func validLatLng(lat, lng float64) bool {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// NearbyVenues godoc
//
//	@Summary		Venues the caller is at, to check in at, nearest first
//	@Description	Saved venues with coordinates and Google Places venues (clubs, bars, event spaces) within a few hundred meters of lat/lng, up to 5. A Google place already saved is listed once, as the saved venue. The coordinates aren't stored.
//	@Tags			check-ins
//	@Produce		json
//	@Param			lat	query		number	true	"the caller's latitude"
//	@Param			lng	query		number	true	"the caller's longitude"
//	@Success		200	{object}	NearbyVenuesResponse
//	@Failure		400	{object}	errorEnvelope
//	@Failure		401	{object}	errorEnvelope
//	@Security		BearerAuth
//	@Router			/api/check-ins/nearby [get]
func (h *Handlers) NearbyVenues(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	lat, err1 := strconv.ParseFloat(q.Get("lat"), 64)
	lng, err2 := strconv.ParseFloat(q.Get("lng"), 64)
	if err1 != nil || err2 != nil || !validLatLng(lat, lng) {
		BadRequest(w, "lat and lng are required")
		return
	}
	// A box around the point (a degree of latitude is ~111km; longitude
	// degrees shrink toward the poles), measured exactly below.
	dLat := nearbyVenuesRadiusM / 111000.0
	dLng := dLat / math.Max(math.Cos(lat*math.Pi/180), 0.01)
	points, err := queries.VenuesInBox(r.Context(), h.Pool, lat-dLat, lat+dLat, lng-dLng, lng+dLng)
	if err != nil {
		InternalError(w, err)
		return
	}
	venues := []NearbyVenue{}
	saved := map[string]bool{}
	for _, p := range points {
		d := domain.DistanceM(lat, lng, p.Latitude, p.Longitude)
		if d <= nearbyVenuesRadiusM {
			venues = append(venues, NearbyVenue{ID: &p.ID, PlaceID: p.GooglePlaceID, Name: p.Name, City: p.City, DistanceM: int(math.Round(d))})
			if p.GooglePlaceID != nil {
				saved[*p.GooglePlaceID] = true
			}
		}
	}
	// Google fills in the places nobody's logged yet. Without it (not
	// configured, or down) the saved venues still work.
	if h.Places.Configured() {
		places, err := h.Places.SearchNearby(r.Context(), lat, lng, nearbyVenuesRadiusM, nearbyVenuesLimit)
		if err != nil {
			slog.Error("places nearby search failed", "error", err)
		}
		for _, p := range places {
			if saved[p.PlaceID] {
				continue
			}
			d := domain.DistanceM(lat, lng, *p.Latitude, *p.Longitude)
			venues = append(venues, NearbyVenue{PlaceID: &p.PlaceID, Name: p.Name, City: p.City, DistanceM: int(math.Round(d))})
		}
	}
	sort.Slice(venues, func(i, j int) bool { return venues[i].DistanceM < venues[j].DistanceM })
	if len(venues) > nearbyVenuesLimit {
		venues = venues[:nearbyVenuesLimit]
	}
	WriteJSON(w, http.StatusOK, NearbyVenuesResponse{Venues: venues})
}

// CheckIn godoc
//
//	@Summary		Check in at a venue, so the caller's review of it tonight shows as verified
//	@Description	At a saved venue (venueId) or a Google place (placeId, saved as a venue on check-in). The venue must have coordinates, and latitude/longitude must be within 150m of it (up to 400m for a less accurate fix). Only the distance is stored, not the coordinates. A repeat check-in the same night is a no-op.
//	@Tags			check-ins
//	@Accept			json
//	@Produce		json
//	@Param			body	body		checkInRequest	true	"the venue and where the caller is"
//	@Success		200		{object}	CheckInResponse
//	@Failure		400		{object}	errorEnvelope
//	@Failure		401		{object}	errorEnvelope
//	@Failure		404		{object}	errorEnvelope
//	@Failure		422		{object}	errorEnvelope
//	@Security		BearerAuth
//	@Router			/api/check-ins [post]
func (h *Handlers) CheckIn(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req checkInRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if (req.VenueID == "") == (req.PlaceID == "") || !validLatLng(req.Latitude, req.Longitude) {
		BadRequest(w, "one of venueId or placeId, and latitude and longitude, are required")
		return
	}
	var accuracy float64
	var accuracyM *int
	if req.AccuracyM != nil && *req.AccuracyM > 0 {
		accuracy = *req.AccuracyM
		if accuracy > domain.CheckInMaxAccuracyM {
			WriteError(w, http.StatusUnprocessableEntity, "IMPRECISE_LOCATION", "your location isn't precise enough to check in")
			return
		}
		a := int(math.Round(accuracy))
		accuracyM = &a
	}

	var venue *queries.VenuePoint
	var err error
	if req.VenueID != "" {
		if !uuidPattern.MatchString(req.VenueID) {
			NotFound(w)
			return
		}
		venue, err = queries.GetVenuePoint(r.Context(), h.Pool, req.VenueID)
	} else {
		venue, err = h.placeVenuePoint(r.Context(), req.PlaceID)
	}
	switch {
	case errors.Is(err, queries.ErrNotFound):
		NotFound(w)
		return
	case domain.PlacesUnavailable(err):
		WriteError(w, http.StatusServiceUnavailable, "UNAVAILABLE", "place search is unavailable right now")
		return
	case err != nil:
		InternalError(w, err)
		return
	}
	distance := domain.DistanceM(req.Latitude, req.Longitude, venue.Latitude, venue.Longitude)
	if distance > domain.CheckInRadiusM(accuracy) {
		WriteError(w, http.StatusUnprocessableEntity, "TOO_FAR", "you're not at this venue")
		return
	}
	distanceM := int(math.Round(distance))
	// A Google place is saved as a venue only once someone's checked in
	// there, so a review picking the same place lands on the same venue.
	if venue.ID == "" {
		saved, err := queries.UpsertPlaceVenue(r.Context(), h.Pool, queries.CreatePlaceVenueParams{
			GooglePlaceID:   *venue.GooglePlaceID,
			Name:            truncateRunes(venue.Name, 160),
			City:            venue.City,
			Latitude:        &venue.Latitude,
			Longitude:       &venue.Longitude,
			CreatedByUserID: user.ID,
		})
		if err != nil {
			InternalError(w, err)
			return
		}
		venue.ID = saved.ID
	}
	at, err := queries.CreateCheckIn(r.Context(), h.Pool, user.ID, venue.ID, distanceM, accuracyM, time.Now().Add(-checkInRepeatWindow))
	if err != nil {
		InternalError(w, err)
		return
	}
	friends, err := queries.FriendsCheckedInAt(r.Context(), h.Pool, user.ID, venue.ID, time.Now().Add(-friendsHereWindow))
	if err != nil {
		InternalError(w, err)
		return
	}
	h.notifyHereToo(user, venue.ID, venue.Name, friends)
	WriteJSON(w, http.StatusOK, CheckInResponse{
		Venue:       NearbyVenue{ID: &venue.ID, PlaceID: venue.GooglePlaceID, Name: venue.Name, City: venue.City, DistanceM: distanceM},
		CheckedInAt: at,
		FriendsHere: orEmpty(friends),
	})
}

// placeVenuePoint is a Google place's point: its saved venue if there is
// one, otherwise from Place Details with an empty ID (not saved yet).
// ErrNotFound if Google doesn't know the place or it has no location.
func (h *Handlers) placeVenuePoint(ctx context.Context, placeID string) (*queries.VenuePoint, error) {
	v, err := queries.GetVenueByPlaceID(ctx, h.Pool, placeID)
	if err == nil {
		if v.Latitude == nil || v.Longitude == nil {
			return nil, queries.ErrNotFound
		}
		return &queries.VenuePoint{ID: v.ID, Name: v.Name, City: v.City, Latitude: *v.Latitude, Longitude: *v.Longitude, GooglePlaceID: v.GooglePlaceID}, nil
	}
	if !errors.Is(err, queries.ErrNotFound) {
		return nil, err
	}
	place, err := h.Places.Details(ctx, placeID, "")
	if domain.PlacesUnavailable(err) {
		return nil, err
	}
	if err != nil || place.Latitude == nil || place.Longitude == nil {
		if err != nil {
			slog.Error("places details failed", "placeId", placeID, "error", err)
		}
		return nil, queries.ErrNotFound
	}
	return &queries.VenuePoint{Name: place.Name, City: place.City, Latitude: *place.Latitude, Longitude: *place.Longitude, GooglePlaceID: &place.PlaceID}, nil
}
