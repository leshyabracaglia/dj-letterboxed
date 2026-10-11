package domain

import "testing"

func TestRAEventName(t *testing.T) {
	venue := RAVenue{Name: "Nowadays"}
	cases := []struct {
		title   string
		artists []string
		want    string
	}{
		{"Serum: Dixon", []string{"Dixon"}, "Serum"},
		{"Wata Igarashi all night long / ISAbella", []string{"Wata Igarashi", "ISAbella"}, ""},
		{"Innervisions NY", []string{"Dixon", "Âme"}, "Innervisions NY"},
		{"Nowadays: Mister Saturday Night", nil, ""},
	}
	for _, tc := range cases {
		e := RAEvent{Title: tc.title, Venue: venue}
		for _, a := range tc.artists {
			e.Artists = append(e.Artists, RAArtist{Name: a})
		}
		if got := RAEventName(e); got != tc.want {
			t.Errorf("RAEventName(%q) = %q, want %q", tc.title, got, tc.want)
		}
	}
}

func TestRADayNight(t *testing.T) {
	cases := []struct {
		start, end     string
		wantDay, night bool
	}{
		{"2026-10-09T22:30:00", "2026-10-10T07:00:00", false, true},
		{"2026-10-10T14:00:00", "2026-10-10T20:00:00", true, false},
		{"2026-10-10T14:00:00", "2026-10-11T04:00:00", true, true},
		{"", "", false, true},
	}
	for _, tc := range cases {
		day, night := RADayNight(RAEvent{StartTime: tc.start, EndTime: tc.end})
		if day != tc.wantDay || night != tc.night {
			t.Errorf("RADayNight(%s, %s) = %v, %v; want %v, %v", tc.start, tc.end, day, night, tc.wantDay, tc.night)
		}
	}
}

func TestArtistNames(t *testing.T) {
	if got := RAArtistName("Louis Marlo (live)"); got != "Louis Marlo" {
		t.Errorf("RAArtistName = %q", got)
	}
	if !SameNameLoosely("DjRUM", "Djrum") || !SameNameLoosely("DJ Tool", "dj-tool") || SameNameLoosely("Dixon", "Dixons") {
		t.Error("SameNameLoosely mismatch")
	}
	if RAAreaQuery("Brooklyn") != "New York City" || RAAreaQuery("Berlin") != "Berlin" {
		t.Error("RAAreaQuery mismatch")
	}
}
