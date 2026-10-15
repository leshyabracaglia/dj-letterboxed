package httpapi

import (
	"errors"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

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

// NearbyVenue is a venue the caller could check in at.
type NearbyVenue struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	City      *string `json:"city" extensions:"x-nullable"`
	DistanceM int     `json:"distanceM"`
}

type NearbyVenuesResponse struct {
	Venues []NearbyVenue `json:"venues"`
}

type checkInRequest struct {
	VenueID   string  `json:"venueId"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	// How accurate the device says the fix is, in meters.
	AccuracyM *float64 `json:"accuracyM"`
}

type CheckInResponse struct {
	Venue NearbyVenue `json:"venue"`
	// When the caller checked in there (an earlier check-in the same night
	// stands). Logging the venue for that night shows as verified.
	CheckedInAt time.Time `json:"checkedInAt"`
}

func validLatLng(lat, lng float64) bool {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// NearbyVenues godoc
//
//	@Summary		Venues the caller is at, to check in at, nearest first
//	@Description	Saved venues with coordinates within a few hundred meters of lat/lng. The coordinates aren't stored.
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
	for _, p := range points {
		d := domain.DistanceM(lat, lng, p.Latitude, p.Longitude)
		if d <= nearbyVenuesRadiusM {
			venues = append(venues, NearbyVenue{ID: p.ID, Name: p.Name, City: p.City, DistanceM: int(math.Round(d))})
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
//	@Summary		Check in at a venue, so the caller's log of it tonight shows as verified
//	@Description	The venue must have coordinates, and latitude/longitude must be within 150m of it (up to 400m for a less accurate fix). Only the distance is stored, not the coordinates. A repeat check-in the same night is a no-op.
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
	if req.VenueID == "" || !validLatLng(req.Latitude, req.Longitude) {
		BadRequest(w, "venueId, latitude and longitude are required")
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

	venue, err := queries.GetVenuePoint(r.Context(), h.Pool, req.VenueID)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	distance := domain.DistanceM(req.Latitude, req.Longitude, venue.Latitude, venue.Longitude)
	if distance > domain.CheckInRadiusM(accuracy) {
		WriteError(w, http.StatusUnprocessableEntity, "TOO_FAR", "you're not at this venue")
		return
	}
	distanceM := int(math.Round(distance))
	at, err := queries.CreateCheckIn(r.Context(), h.Pool, user.ID, venue.ID, distanceM, accuracyM, time.Now().Add(-checkInRepeatWindow))
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, CheckInResponse{
		Venue:       NearbyVenue{ID: venue.ID, Name: venue.Name, City: venue.City, DistanceM: distanceM},
		CheckedInAt: at,
	})
}
