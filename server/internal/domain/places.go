package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Google Places API (New). Autocomplete feeds the venue search box; Place
// Details runs once, when a picked place is first saved as a venue. Both
// take the same client-generated session token, so Google bills the search
// and the pick as a single session instead of per keystroke.

var ErrPlacesNotConfigured = errors.New("google places api key is not configured")

// ErrPlacesOverBudget is every caller together having made today's
// allowance of Google calls (see NewPlacesClient's dailyLimit).
var ErrPlacesOverBudget = errors.New("google places daily call budget used up")

// PlacesUnavailable is whether err means Google can't be called right now
// (no key, or today's budget used up), as opposed to a call that failed.
func PlacesUnavailable(err error) bool {
	return errors.Is(err, ErrPlacesNotConfigured) || errors.Is(err, ErrPlacesOverBudget)
}

type PlaceSuggestion struct {
	PlaceID string `json:"placeId"`
	Name    string `json:"name"`
	// SecondaryText is the rest of the place's description, usually its
	// street address and city.
	SecondaryText string `json:"secondaryText"`
}

type PlaceDetails struct {
	PlaceID   string
	Name      string
	Address   *string
	City      *string
	Latitude  *float64
	Longitude *float64
}

type placesCacheEntry struct {
	value     any
	expiresAt time.Time
}

type PlacesClient struct {
	apiKey  string
	baseURL string
	http    *http.Client

	// Every Google call, from every user, counts against dailyLimit (0 for
	// none): the per-user rate limits can be multiplied by signing up more
	// accounts, this can't.
	dailyLimit int

	mu          sync.Mutex
	calls       int
	windowStart time.Time
	cache       map[string]placesCacheEntry
}

func NewPlacesClient(apiKey string, dailyLimit int) *PlacesClient {
	return &PlacesClient{
		apiKey:     apiKey,
		baseURL:    "https://places.googleapis.com/v1",
		http:       &http.Client{Timeout: 5 * time.Second},
		dailyLimit: dailyLimit,
		cache:      map[string]placesCacheEntry{},
	}
}

func (c *PlacesClient) Configured() bool {
	return c != nil && c.apiKey != ""
}

// spend takes one call out of today's budget, or fails with
// ErrPlacesNotConfigured / ErrPlacesOverBudget. The budget counts in
// memory, so it resets on a deploy as well as daily.
func (c *PlacesClient) spend() error {
	if !c.Configured() {
		return ErrPlacesNotConfigured
	}
	if c.dailyLimit <= 0 {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Since(c.windowStart) >= 24*time.Hour {
		c.windowStart = time.Now()
		c.calls = 0
	}
	if c.calls >= c.dailyLimit {
		return ErrPlacesOverBudget
	}
	c.calls++
	if c.calls == c.dailyLimit {
		slog.Warn("google places daily call budget used up; place lookups are off until it resets",
			"limit", c.dailyLimit, "resetsAt", c.windowStart.Add(24*time.Hour))
	}
	return nil
}

// cached returns the value under key, or fetches and keeps it for ttl.
// Misses are each a Google call, so the daily budget bounds the cache too.
func (c *PlacesClient) cached(key string, ttl time.Duration, fetch func() (any, error)) (any, error) {
	c.mu.Lock()
	if e, ok := c.cache[key]; ok && e.expiresAt.After(time.Now()) {
		c.mu.Unlock()
		return e.value, nil
	}
	c.mu.Unlock()

	v, err := fetch()
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	for k, e := range c.cache {
		if e.expiresAt.Before(time.Now()) {
			delete(c.cache, k)
		}
	}
	c.cache[key] = placesCacheEntry{value: v, expiresAt: time.Now().Add(ttl)}
	c.mu.Unlock()
	return v, nil
}

func (c *PlacesClient) do(ctx context.Context, method, path string, body any, fieldMask string, out any) error {
	if err := c.spend(); err != nil {
		return err
	}

	var reader io.Reader = http.NoBody
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("X-Goog-Api-Key", c.apiKey)
	req.Header.Set("X-Goog-FieldMask", fieldMask)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Google's error body names the actual cause (API not enabled, key
		// restrictions, billing), which the status code alone doesn't.
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("google places %s %s failed: %d: %s", method, path, resp.StatusCode, bytes.TrimSpace(detail))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *PlacesClient) Autocomplete(ctx context.Context, input, sessionToken string) ([]PlaceSuggestion, error) {
	body := map[string]any{"input": input}
	if sessionToken != "" {
		body["sessionToken"] = sessionToken
	}

	var data struct {
		Suggestions []struct {
			PlacePrediction *struct {
				PlaceID          string `json:"placeId"`
				StructuredFormat struct {
					MainText      struct{ Text string } `json:"mainText"`
					SecondaryText struct{ Text string } `json:"secondaryText"`
				} `json:"structuredFormat"`
			} `json:"placePrediction"`
		} `json:"suggestions"`
	}
	err := c.do(ctx, http.MethodPost, "/places:autocomplete", body,
		"suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat", &data)
	if err != nil {
		return nil, err
	}

	out := make([]PlaceSuggestion, 0, len(data.Suggestions))
	for _, s := range data.Suggestions {
		// Query predictions (search-term suggestions) have no place.
		if s.PlacePrediction == nil {
			continue
		}
		p := s.PlacePrediction
		out = append(out, PlaceSuggestion{
			PlaceID:       p.PlaceID,
			Name:          p.StructuredFormat.MainText.Text,
			SecondaryText: p.StructuredFormat.SecondaryText.Text,
		})
	}
	return out, nil
}

// TopSuggestion is the first autocomplete suggestion for input (nil if
// none), cached for a day: matching an RA night's venue asks about the same
// few venues over and over.
func (c *PlacesClient) TopSuggestion(ctx context.Context, input, sessionToken string) (*PlaceSuggestion, error) {
	v, err := c.cached("suggest:"+input, 24*time.Hour, func() (any, error) {
		suggestions, err := c.Autocomplete(ctx, input, sessionToken)
		if err != nil || len(suggestions) == 0 {
			return (*PlaceSuggestion)(nil), err
		}
		return &suggestions[0], nil
	})
	if err != nil {
		return nil, err
	}
	return v.(*PlaceSuggestion), nil
}

// nearbyVenueTypes are the kinds of place a night out happens at, for
// SearchNearby. Without them the nearest places to someone in a club are
// the shops next door.
var nearbyVenueTypes = []string{
	"night_club", "bar", "pub", "cocktail_bar", "lounge_bar", "live_music_venue", "dance_hall",
	"event_venue", "concert_hall", "performing_arts_theater", "amphitheatre", "auditorium", "arena", "stadium",
}

// SearchNearby lists venue-like places within radiusM of a point, nearest
// first (Nearby Search, for checking in).
func (c *PlacesClient) SearchNearby(ctx context.Context, lat, lng, radiusM float64, max int) ([]PlaceDetails, error) {
	body := map[string]any{
		"includedTypes":  nearbyVenueTypes,
		"maxResultCount": max,
		"rankPreference": "DISTANCE",
		"locationRestriction": map[string]any{
			"circle": map[string]any{
				"center": map[string]float64{"latitude": lat, "longitude": lng},
				"radius": radiusM,
			},
		},
	}
	var data struct {
		Places []struct {
			ID          string `json:"id"`
			DisplayName struct {
				Text string `json:"text"`
			} `json:"displayName"`
			AddressComponents []placeAddressComponent `json:"addressComponents"`
			Location          *struct {
				Latitude  float64 `json:"latitude"`
				Longitude float64 `json:"longitude"`
			} `json:"location"`
		} `json:"places"`
	}
	err := c.do(ctx, http.MethodPost, "/places:searchNearby", body,
		"places.id,places.displayName,places.addressComponents,places.location", &data)
	if err != nil {
		return nil, err
	}

	out := make([]PlaceDetails, 0, len(data.Places))
	for _, p := range data.Places {
		if p.ID == "" || p.Location == nil {
			continue
		}
		lat, lng := p.Location.Latitude, p.Location.Longitude
		out = append(out, PlaceDetails{
			PlaceID:   p.ID,
			Name:      p.DisplayName.Text,
			City:      cityFromAddressComponents(p.AddressComponents),
			Latitude:  &lat,
			Longitude: &lng,
		})
	}
	return out, nil
}

type placeAddressComponent struct {
	LongText string   `json:"longText"`
	Types    []string `json:"types"`
}

func (c *PlacesClient) Details(ctx context.Context, placeID, sessionToken string) (*PlaceDetails, error) {
	path := "/places/" + url.PathEscape(placeID)
	if sessionToken != "" {
		path += "?sessionToken=" + url.QueryEscape(sessionToken)
	}

	var data struct {
		ID          string `json:"id"`
		DisplayName struct {
			Text string `json:"text"`
		} `json:"displayName"`
		FormattedAddress  string                  `json:"formattedAddress"`
		AddressComponents []placeAddressComponent `json:"addressComponents"`
		Location          *struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"location"`
	}
	err := c.do(ctx, http.MethodGet, path, nil,
		"id,displayName,formattedAddress,addressComponents,location", &data)
	if err != nil {
		return nil, err
	}

	d := &PlaceDetails{
		PlaceID: data.ID,
		Name:    data.DisplayName.Text,
		City:    cityFromAddressComponents(data.AddressComponents),
	}
	if d.PlaceID == "" {
		d.PlaceID = placeID
	}
	if data.FormattedAddress != "" {
		d.Address = &data.FormattedAddress
	}
	if data.Location != nil {
		d.Latitude = &data.Location.Latitude
		d.Longitude = &data.Location.Longitude
	}
	return d, nil
}

// cityFromAddressComponents picks the most city-like component: locality
// covers most places, postal_town is the UK equivalent, and some places
// (e.g. inside a NYC borough) only carry a sublocality. Two places name a
// smaller area than people go by: Tokyo's wards come back as the locality
// ("Taito City"), so anywhere in Tokyo is Tokyo; and much of Indonesia
// (Bali among it) has no locality at all, only a regency ("Kabupaten
// Badung"), so a regency gives way to its province.
func cityFromAddressComponents(components []placeAddressComponent) *string {
	find := func(want string) string {
		for _, c := range components {
			for _, t := range c.Types {
				if t == want && c.LongText != "" {
					return c.LongText
				}
			}
		}
		return ""
	}
	region := find("administrative_area_level_1")
	if region == "Tokyo" {
		return &region
	}
	for _, want := range []string{"locality", "postal_town", "sublocality", "administrative_area_level_2"} {
		city := find(want)
		if city == "" {
			continue
		}
		if want == "administrative_area_level_2" && strings.HasPrefix(city, "Kabupaten ") && region != "" {
			return &region
		}
		return &city
	}
	return nil
}

// GeocodedCity is the city and region (state/province) at a point.
type GeocodedCity struct {
	City   *string
	Region *string
}

// ReverseGeocodeCity looks up the city at a point with the Geocoding API
// (for web clients, which can't reverse geocode on the device). It needs
// the Geocoding API enabled for the same key. The point is rounded to about
// a kilometer, which is plenty to name a city, before it's sent or cached.
func (c *PlacesClient) ReverseGeocodeCity(ctx context.Context, lat, lng float64) (*GeocodedCity, error) {
	if !c.Configured() {
		return nil, ErrPlacesNotConfigured
	}
	point := fmt.Sprintf("%.2f,%.2f", lat, lng)
	v, err := c.cached("geocode:"+point, 24*time.Hour, func() (any, error) {
		return c.reverseGeocode(ctx, point)
	})
	if err != nil {
		return nil, err
	}
	return v.(*GeocodedCity), nil
}

func (c *PlacesClient) reverseGeocode(ctx context.Context, point string) (*GeocodedCity, error) {
	if err := c.spend(); err != nil {
		return nil, err
	}
	u := "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + point + "&key=" + url.QueryEscape(c.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		// The error quotes the URL, which has the API key in it; it gets logged.
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return nil, fmt.Errorf("google geocoding request failed: %w", err)
	}
	defer resp.Body.Close()

	var data struct {
		Status       string `json:"status"`
		ErrorMessage string `json:"error_message"`
		Results      []struct {
			AddressComponents []struct {
				LongName string   `json:"long_name"`
				Types    []string `json:"types"`
			} `json:"address_components"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" && data.Status != "ZERO_RESULTS" {
		return nil, fmt.Errorf("google geocoding failed: %s: %s", data.Status, data.ErrorMessage)
	}
	out := &GeocodedCity{}
	for _, r := range data.Results {
		components := make([]placeAddressComponent, 0, len(r.AddressComponents))
		for _, ac := range r.AddressComponents {
			components = append(components, placeAddressComponent{LongText: ac.LongName, Types: ac.Types})
		}
		if out.City == nil {
			out.City = cityFromAddressComponents(components)
		}
		if out.Region == nil {
			for _, ac := range components {
				if len(ac.Types) > 0 && ac.Types[0] == "administrative_area_level_1" {
					region := ac.LongText
					out.Region = &region
				}
			}
		}
		if out.City != nil && out.Region != nil {
			break
		}
	}
	return out, nil
}
