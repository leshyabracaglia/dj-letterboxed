package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Google Places API (New). Autocomplete feeds the venue search box; Place
// Details runs once, when a picked place is first saved as a venue. Both
// take the same client-generated session token, so Google bills the search
// and the pick as a single session instead of per keystroke.

var ErrPlacesNotConfigured = errors.New("google places api key is not configured")

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

type PlacesClient struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

func NewPlacesClient(apiKey string) *PlacesClient {
	return &PlacesClient{
		apiKey:  apiKey,
		baseURL: "https://places.googleapis.com/v1",
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *PlacesClient) Configured() bool {
	return c != nil && c.apiKey != ""
}

func (c *PlacesClient) do(ctx context.Context, method, path string, body any, fieldMask string, out any) error {
	if !c.Configured() {
		return ErrPlacesNotConfigured
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
		return fmt.Errorf("google places %s %s failed: %d", method, path, resp.StatusCode)
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
// (e.g. inside a NYC borough) only carry a sublocality.
func cityFromAddressComponents(components []placeAddressComponent) *string {
	for _, want := range []string{"locality", "postal_town", "sublocality", "administrative_area_level_2"} {
		for _, c := range components {
			for _, t := range c.Types {
				if t == want && c.LongText != "" {
					city := c.LongText
					return &city
				}
			}
		}
	}
	return nil
}
