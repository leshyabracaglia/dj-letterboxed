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
	c := NewPlacesClient("test-key")
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
	c := NewPlacesClient("")
	if _, err := c.Autocomplete(context.Background(), "x", ""); !errors.Is(err, ErrPlacesNotConfigured) {
		t.Fatalf("err = %v, want ErrPlacesNotConfigured", err)
	}
}
