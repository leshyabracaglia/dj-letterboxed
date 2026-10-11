package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

var (
	raIDPattern   = regexp.MustCompile(`^[0-9]{1,12}$`)
	isoDayPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
)

// The log screen looks back at most this far for RA nights to pick from.
const raMaxLookbackDays = 14

func writeRAError(w http.ResponseWriter, err error) {
	slog.Error("resident advisor request failed", "error", err)
	WriteError(w, http.StatusBadGateway, "UPSTREAM_ERROR", "Resident Advisor is unavailable")
}

// SearchRAAreas godoc
//
//	@Summary	Search Resident Advisor's areas (cities and regions) by name
//	@Tags		ra
//	@Produce	json
//	@Param		q	query		string	true	"area name"
//	@Success	200	{array}		domain.RAArea
//	@Failure	401	{object}	errorEnvelope
//	@Failure	502	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/ra/areas [get]
func (h *Handlers) SearchRAAreas(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
		return
	}
	areas, err := h.RA.SearchAreas(r.Context(), strings.TrimSpace(q))
	if err != nil {
		writeRAError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(areas))
}

type RAEventsResponse struct {
	// Area is the one listed: the one asked for, or the area of the
	// caller's latest night out; null when neither is known.
	Area   *domain.RAArea   `json:"area"`
	Events []domain.RAEvent `json:"events"`
}

// ListRAEvents godoc
//
//	@Summary		List Resident Advisor nights in an area over a few days, most attended first
//	@Description	The area is areaId if given, else the RA area of where the caller is (city/region, as their device geocoded it, or lat/lng, geocoded here), else of the city of their latest night out. area is null, with no events, if none is known. from/to are the caller's local days; at most two weeks back.
//	@Tags			ra
//	@Produce		json
//	@Param			areaId	query		string	false	"RA area id"
//	@Param			city	query		string	false	"the caller's current city"
//	@Param			region	query		string	false	"the caller's current state/province, tried when the city isn't an RA area"
//	@Param			lat		query		number	false	"the caller's latitude, when the device couldn't name the city"
//	@Param			lng		query		number	false	"the caller's longitude"
//	@Param			from	query		string	true	"first day, YYYY-MM-DD"
//	@Param			to		query		string	true	"last day, YYYY-MM-DD"
//	@Success		200		{object}	RAEventsResponse
//	@Failure		400		{object}	errorEnvelope
//	@Failure		401		{object}	errorEnvelope
//	@Failure		502		{object}	errorEnvelope
//	@Security		BearerAuth
//	@Router			/api/ra/events [get]
func (h *Handlers) ListRAEvents(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	from, to := r.URL.Query().Get("from"), r.URL.Query().Get("to")
	fromDay, err1 := time.Parse(time.DateOnly, from)
	toDay, err2 := time.Parse(time.DateOnly, to)
	if !isoDayPattern.MatchString(from) || !isoDayPattern.MatchString(to) || err1 != nil || err2 != nil ||
		toDay.Before(fromDay) || toDay.Sub(fromDay) > raMaxLookbackDays*24*time.Hour {
		BadRequest(w, "from and to must be days (YYYY-MM-DD) at most two weeks apart")
		return
	}

	var area *domain.RAArea
	if areaID := r.URL.Query().Get("areaId"); areaID != "" {
		if !raIDPattern.MatchString(areaID) {
			BadRequest(w, "unknown areaId")
			return
		}
		area = &domain.RAArea{ID: areaID}
	} else {
		var err error
		area, err = h.findRAArea(ctx, r, user.ID)
		if err != nil {
			writeRAError(w, err)
			return
		}
	}
	if area == nil {
		WriteJSON(w, http.StatusOK, RAEventsResponse{Events: []domain.RAEvent{}})
		return
	}

	events, err := h.RA.EventListings(ctx, area.ID, from, to)
	if err != nil {
		writeRAError(w, err)
		return
	}
	// An area picked by id only carries its id; name it from a listing.
	if area.Name == "" && len(events) > 0 {
		area.Name = events[0].Venue.Area
	}
	WriteJSON(w, http.StatusOK, RAEventsResponse{Area: area, Events: orEmpty(events)})
}

// findRAArea finds the RA area for where the caller is: the first of their
// city, their region, the city at their lat/lng, and the city of their
// latest night out that RA has an area for. Nil if none.
func (h *Handlers) findRAArea(ctx context.Context, r *http.Request, userID string) (*domain.RAArea, error) {
	q := r.URL.Query()
	var places []string
	for _, p := range []string{q.Get("city"), q.Get("region")} {
		if p = strings.TrimSpace(p); p != "" && len(p) <= 120 {
			places = append(places, p)
		}
	}
	if len(places) == 0 && q.Get("lat") != "" {
		lat, err1 := strconv.ParseFloat(q.Get("lat"), 64)
		lng, err2 := strconv.ParseFloat(q.Get("lng"), 64)
		if err1 == nil && err2 == nil && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 {
			geo, err := h.Places.ReverseGeocodeCity(ctx, lat, lng)
			if err != nil {
				// Fall back to their latest log's city rather than failing.
				slog.Error("reverse geocoding failed", "error", err)
			} else {
				for _, p := range []*string{geo.City, geo.Region} {
					if p != nil {
						places = append(places, *p)
					}
				}
			}
		}
	}
	city, err := queries.LatestLogCity(ctx, h.Pool, userID)
	if err != nil {
		return nil, err
	}
	if city != nil {
		places = append(places, *city)
	}

	for _, p := range places {
		areas, err := h.RA.SearchAreas(ctx, domain.RAAreaQuery(p))
		if err != nil {
			return nil, err
		}
		for _, a := range areas {
			// RA's search is fuzzy; only take an area that's really this place.
			if domain.SameNameLoosely(a.Name, domain.RAAreaQuery(p)) || len(areas) == 1 {
				area := a
				return &area, nil
			}
		}
	}
	return nil, nil
}

// RAArtistMatch is one name on an RA lineup: the Beatboxd DJ it already
// is, else the Spotify artist of the same name (created as a DJ when the
// night is saved), else neither (created by name).
type RAArtistMatch struct {
	Name    string                `json:"name"`
	Dj      *db.Dj                `json:"dj"`
	Spotify *domain.SpotifyArtist `json:"spotify"`
}

// RAVenueMatch is an RA venue as a saved venue, else a Google place (send
// placeId with placeSessionToken when logging), else a name and city to
// add by hand.
type RAVenueMatch struct {
	Venue             *queries.VenueSummary   `json:"venue"`
	Place             *domain.PlaceSuggestion `json:"place"`
	PlaceSessionToken string                  `json:"placeSessionToken"`
	Name              string                  `json:"name"`
	City              string                  `json:"city"`
}

type RAEventMatchResponse struct {
	Event domain.RAEvent `json:"event"`
	// EventName is the party's name, or null when the night has none (an
	// RA title that's just the lineup) and is headed by the venue.
	EventName *string         `json:"eventName"`
	SeenAt    string          `json:"seenAt"`
	IsDay     bool            `json:"isDay"`
	IsNight   bool            `json:"isNight"`
	Venue     RAVenueMatch    `json:"venue"`
	Lineup    []RAArtistMatch `json:"lineup"`
}

// MatchRAEvent godoc
//
//	@Summary		Turn a Resident Advisor night into a log to fill in
//	@Description	Matches the lineup to Beatboxd DJs or Spotify artists, and the venue to a saved venue or a Google place, so the log form can be prefilled. Nothing is saved.
//	@Tags			ra
//	@Produce		json
//	@Param			id	path		string	true	"RA event id"
//	@Success		200	{object}	RAEventMatchResponse
//	@Failure		401	{object}	errorEnvelope
//	@Failure		404	{object}	errorEnvelope
//	@Failure		502	{object}	errorEnvelope
//	@Security		BearerAuth
//	@Router			/api/ra/events/{id}/match [get]
func (h *Handlers) MatchRAEvent(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !raIDPattern.MatchString(id) {
		NotFound(w)
		return
	}
	ctx := r.Context()
	event, err := h.RA.Event(ctx, id)
	if err != nil {
		writeRAError(w, err)
		return
	}
	if event == nil {
		NotFound(w)
		return
	}

	resp := RAEventMatchResponse{Event: *event, SeenAt: event.Date}
	if name := domain.RAEventName(*event); name != "" {
		resp.EventName = &name
	}
	resp.IsDay, resp.IsNight = domain.RADayNight(*event)

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		resp.Venue = h.matchRAVenue(ctx, event.Venue)
	}()
	resp.Lineup = h.matchRAArtists(ctx, event.Artists)
	wg.Wait()

	WriteJSON(w, http.StatusOK, resp)
}

func newPlacesSessionToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// matchRAVenue looks the venue up on Google by name and address; a place
// someone already saved is that venue. Without a place, a saved venue of
// the same name, else the name to add by hand. Lookup failures fall
// through to the next option rather than failing the match.
func (h *Handlers) matchRAVenue(ctx context.Context, v domain.RAVenue) RAVenueMatch {
	m := RAVenueMatch{Name: v.Name, City: v.Area}
	if v.Name == "" {
		return m
	}
	if h.Places.Configured() {
		token := newPlacesSessionToken()
		input := v.Name
		if v.Address != "" {
			input += ", " + v.Address
		}
		suggestions, err := h.Places.Autocomplete(ctx, input, token)
		if err != nil {
			slog.Error("places autocomplete for RA venue failed", "venue", v.Name, "error", err)
		} else if len(suggestions) > 0 {
			place := suggestions[0]
			saved, err := queries.GetVenueSummaryByPlaceID(ctx, h.Pool, place.PlaceID)
			if err == nil {
				m.Venue = saved
				return m
			}
			if !errors.Is(err, queries.ErrNotFound) {
				slog.Error("venue lookup failed", "error", err)
			}
			m.Place = &place
			m.PlaceSessionToken = token
			return m
		}
	}
	if saved, err := queries.GetVenueSummaryByName(ctx, h.Pool, v.Name); err == nil {
		m.Venue = saved
	}
	return m
}

// matchRAArtists matches each lineup name, a few at a time, keeping RA's
// order. Lineups longer than a log allows are cut at its limit.
func (h *Handlers) matchRAArtists(ctx context.Context, artists []domain.RAArtist) []RAArtistMatch {
	if len(artists) > maxLineup {
		artists = artists[:maxLineup]
	}
	out := make([]RAArtistMatch, len(artists))
	sem := make(chan struct{}, 5)
	var wg sync.WaitGroup
	for i, a := range artists {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			out[i] = h.matchRAArtist(ctx, domain.RAArtistName(a.Name))
		}()
	}
	wg.Wait()
	return out
}

func (h *Handlers) matchRAArtist(ctx context.Context, name string) RAArtistMatch {
	m := RAArtistMatch{Name: name}
	if dj, err := queries.GetDjByName(ctx, h.Pool, name); err == nil && dj.SpotifyID != nil {
		m.Dj = dj
		return m
	} else if err == nil {
		// A community-added DJ; still worth checking Spotify below in case
		// someone added a different, Spotify-linked one.
		m.Dj = dj
	}
	results, err := h.Spotify.SearchArtists(name)
	if err != nil {
		slog.Error("spotify search for RA artist failed", "name", name, "error", err)
		return m
	}
	for _, artist := range results {
		if !domain.SameNameLoosely(artist.Name, name) {
			continue
		}
		if dj, err := queries.GetDjBySpotifyID(ctx, h.Pool, artist.SpotifyID); err == nil {
			m.Dj = dj
			return m
		}
		if m.Dj == nil {
			artist := artist
			m.Spotify = &artist
		}
		return m
	}
	return m
}
