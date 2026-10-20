package domain

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestPlacesClient(t *testing.T, handler http.HandlerFunc) *PlacesClient {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	c := NewPlacesClient("test-key", 0)
	c.baseURL = srv.URL
	return c
}

func TestPlacesAutocomplete(t *testing.T) {
	c := newTestPlacesClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/places:autocomplete" || r.Method != http.MethodPost {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("X-Goog-Api-Key"); got != "test-key" {
			t.Errorf("api key header = %q", got)
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["input"] != "berghain" || body["sessionToken"] != "tok" {
			t.Errorf("body = %v", body)
		}
		_, _ = w.Write([]byte(`{"suggestions":[
			{"placePrediction":{"placeId":"abc","structuredFormat":{
				"mainText":{"text":"Berghain"},"secondaryText":{"text":"Am Wriezener Bahnhof, Berlin, Germany"}}}},
			{"queryPrediction":{"text":{"text":"berghain tickets"}}}
		]}`))
	})

	got, err := c.Autocomplete(context.Background(), "berghain", "tok")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d suggestions, want 1 (query predictions skipped)", len(got))
	}
	want := PlaceSuggestion{PlaceID: "abc", Name: "Berghain", SecondaryText: "Am Wriezener Bahnhof, Berlin, Germany"}
	if got[0] != want {
		t.Errorf("got %+v, want %+v", got[0], want)
	}
}

func TestPlacesDetails(t *testing.T) {
	c := newTestPlacesClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/places/abc" || r.URL.Query().Get("sessionToken") != "tok" {
			t.Errorf("unexpected request %s", r.URL.String())
		}
		_, _ = w.Write([]byte(`{
			"id":"abc",
			"displayName":{"text":"Berghain"},
			"formattedAddress":"Am Wriezener Bahnhof, 10243 Berlin, Germany",
			"addressComponents":[
				{"longText":"Friedrichshain","types":["sublocality_level_1","sublocality","political"]},
				{"longText":"Berlin","types":["locality","political"]}
			],
			"location":{"latitude":52.511,"longitude":13.443}
		}`))
	})

	d, err := c.Details(context.Background(), "abc", "tok")
	if err != nil {
		t.Fatal(err)
	}
	if d.Name != "Berghain" || d.PlaceID != "abc" {
		t.Errorf("got %+v", d)
	}
	if d.City == nil || *d.City != "Berlin" {
		t.Errorf("city = %v, want Berlin (locality beats sublocality)", d.City)
	}
	if d.Address == nil || d.Latitude == nil || *d.Latitude != 52.511 {
		t.Errorf("address/location not parsed: %+v", d)
	}
}

func TestPlacesUpstreamError(t *testing.T) {
	c := newTestPlacesClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})
	if _, err := c.Autocomplete(context.Background(), "x", ""); err == nil {
		t.Fatal("expected an error on a non-2xx response")
	}
}

func TestPlacesNotConfigured(t *testing.T) {
	c := NewPlacesClient("", 0)
	if _, err := c.Autocomplete(context.Background(), "x", ""); !errors.Is(err, ErrPlacesNotConfigured) {
		t.Fatalf("err = %v, want ErrPlacesNotConfigured", err)
	}
}

func TestPlacesSearchNearby(t *testing.T) {
	c := newTestPlacesClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/places:searchNearby" || r.Method != http.MethodPost {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		var body struct {
			RankPreference      string `json:"rankPreference"`
			MaxResultCount      int    `json:"maxResultCount"`
			LocationRestriction struct {
				Circle struct {
					Radius float64 `json:"radius"`
				} `json:"circle"`
			} `json:"locationRestriction"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.RankPreference != "DISTANCE" || body.MaxResultCount != 5 || body.LocationRestriction.Circle.Radius != 400 {
			t.Errorf("body = %+v", body)
		}
		_, _ = w.Write([]byte(`{"places":[
			{"id":"abc","displayName":{"text":"Berghain"},
			 "addressComponents":[{"longText":"Berlin","types":["locality","political"]}],
			 "location":{"latitude":52.511,"longitude":13.443}},
			{"id":"noloc","displayName":{"text":"Somewhere"}}
		]}`))
	})

	got, err := c.SearchNearby(context.Background(), 52.51, 13.44, 400, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d places, want 1 (places without a location skipped)", len(got))
	}
	if got[0].PlaceID != "abc" || got[0].Name != "Berghain" || got[0].City == nil || *got[0].City != "Berlin" || *got[0].Latitude != 52.511 {
		t.Errorf("got %+v", got[0])
	}
}

func TestPlacesDailyBudget(t *testing.T) {
	calls := 0
	c := newTestPlacesClient(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"suggestions":[]}`))
	})
	c.dailyLimit = 2
	for i := 0; i < 2; i++ {
		if _, err := c.Autocomplete(context.Background(), "x", ""); err != nil {
			t.Fatal(err)
		}
	}
	_, err := c.Autocomplete(context.Background(), "x", "")
	if !errors.Is(err, ErrPlacesOverBudget) || !PlacesUnavailable(err) {
		t.Fatalf("err = %v, want ErrPlacesOverBudget", err)
	}
	if calls != 2 {
		t.Errorf("google got %d calls, want 2 (none once over budget)", calls)
	}
}

func TestPlacesTopSuggestionCached(t *testing.T) {
	calls := 0
	c := newTestPlacesClient(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"suggestions":[{"placePrediction":{"placeId":"abc","structuredFormat":{"mainText":{"text":"Berghain"}}}}]}`))
	})
	for i := 0; i < 3; i++ {
		got, err := c.TopSuggestion(context.Background(), "berghain", "")
		if err != nil || got == nil || got.PlaceID != "abc" {
			t.Fatalf("got %+v, %v", got, err)
		}
	}
	if calls != 1 {
		t.Errorf("google got %d calls, want 1", calls)
	}
}
