package httpapi

import (
	"encoding/json"
	"strings"
	"testing"
)

const (
	djA = "11111111-1111-1111-1111-111111111111"
	djB = "22222222-2222-2222-2222-222222222222"
)

// TestCreateReviewValidate covers the logging rules: a DJ is on the lineup
// once, empty review text is dropped, and nothing has to be rated (a rating
// an older app build still sends is ignored).
func TestCreateReviewValidate(t *testing.T) {
	cases := []struct {
		name           string
		body           string
		wantErr        string
		wantLineup     []string
		wantReviewedDj string
	}{
		{
			name:    "slur in a DJ's review",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"` + djA + `","reviewText":"what a f4ggot"}]}`,
			wantErr: "that includes language that isn't allowed on Beatboxd",
		},
		{
			name:    "slur in a tag",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","tags":["packed","kys"]}`,
			wantErr: "that includes language that isn't allowed on Beatboxd",
		},
		{
			name:       "nothing written, lineup kept",
			body:       `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"` + djA + `"},{"djId":"` + djB + `"}]}`,
			wantLineup: []string{djA, djB},
		},
		{
			name:           "a DJ's set written about",
			body:           `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"` + djA + `"},{"djId":"` + djB + `","reviewText":"huge"}]}`,
			wantLineup:     []string{djA, djB},
			wantReviewedDj: djB,
		},
		{
			name:           "ratings from an older app build are ignored",
			body:           `{"seenAt":"2026-10-04T12:00:00Z","rating":4,"lineup":[{"djId":"` + djA + `","rating":5,"reviewText":"huge"}]}`,
			wantLineup:     []string{djA},
			wantReviewedDj: djA,
		},
		{
			name:    "night text too long",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","reviewText":"` + strings.Repeat("a", 5001) + `"}`,
			wantErr: "reviewText too long",
		},
		{
			name:    "DJ listed twice",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"` + djA + `"},{"djId":"` + djA + `"}]}`,
			wantErr: "a DJ is in the lineup twice",
		},
		{
			name:       "empty DJ text is no text",
			body:       `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"` + djA + `","reviewText":""}]}`,
			wantLineup: []string{djA},
		},
		{
			name:    "bad DJ id",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"nope"}]}`,
			wantErr: "unknown DJ in lineup",
		},
		{
			name:    "future date",
			body:    `{"seenAt":"2999-01-01T12:00:00Z"}`,
			wantErr: "seenAt can't be in the future",
		},
		{
			name:    "bad date",
			body:    `{"seenAt":"2026-10-04"}`,
			wantErr: "seenAt must be an RFC3339 timestamp",
		},
		{
			name:    "a picked event still needs the date",
			body:    `{"eventId":"` + djB + `"}`,
			wantErr: "seenAt must be an RFC3339 timestamp",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req createReviewRequest
			if err := json.Unmarshal([]byte(tc.body), &req); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			v, errMsg := req.validate()
			lineup := v.lineup
			if errMsg != tc.wantErr {
				t.Fatalf("error = %q, want %q", errMsg, tc.wantErr)
			}
			if tc.wantErr != "" {
				return
			}
			if len(lineup) != len(tc.wantLineup) {
				t.Fatalf("lineup = %v, want %v", lineup, tc.wantLineup)
			}
			for i, e := range lineup {
				if e.DjID != tc.wantLineup[i] {
					t.Fatalf("lineup[%d] = %s, want %s", i, e.DjID, tc.wantLineup[i])
				}
				if reviewed := e.ReviewText != nil; reviewed != (e.DjID == tc.wantReviewedDj) {
					t.Fatalf("lineup[%d] reviewed = %v", i, reviewed)
				}
				if e.ReviewText != nil && *e.ReviewText == "" {
					t.Fatalf("lineup[%d] kept empty review text", i)
				}
			}
		})
	}
}

// TestCreateReviewValidateTracks covers the tracks on a night: on the
// lineup's DJs or the night, from a service with its id and its own link and
// cover art, or typed in; a title or a note; length caps; at most maxTracks.
func TestCreateReviewValidateTracks(t *testing.T) {
	night := func(tracks string) string {
		return `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"` + djA + `"}],"tracks":[` + tracks + `]}`
	}
	spotify := `"source":"spotify","externalId":"4uLU6hMCjMI75M1A2tKUQC","title":"Track"`
	cases := []struct {
		name    string
		body    string
		wantErr string
	}{
		{name: "from spotify, on a DJ", body: night(`{"djId":"` + djA + `",` + spotify + `,"url":"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC","artworkUrl":"https://i.scdn.co/image/abc"}`)},
		{name: "from the night, no DJ", body: night(`{` + spotify + `}`)},
		{name: "typed in", body: night(`{"source":"manual","title":"Untitled edit","artist":"Unknown"}`)},
		{name: "unidentified, just a note", body: night(`{"djId":"` + djA + `","source":"manual","note":"Vocal house thing with a sax, 3am"}`)},
		{name: "DJ not on the lineup", body: night(`{"djId":"` + djB + `",` + spotify + `}`), wantErr: "a track's DJ isn't on the lineup"},
		{name: "no title or note", body: night(`{"source":"manual","artist":"Someone"}`), wantErr: "a track needs a title, or a note about it"},
		{name: "blank title is no title", body: night(`{"source":"manual","title":"  "}`), wantErr: "a track needs a title, or a note about it"},
		{name: "service track without its id", body: night(`{"source":"soundcloud","title":"Track"}`), wantErr: "a track from soundcloud needs its externalId"},
		{name: "typed in with a link", body: night(`{"source":"manual","title":"Track","url":"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"}`), wantErr: "a track typed in can't have a link"},
		{name: "link from another service", body: night(`{` + spotify + `,"url":"https://soundcloud.com/forss/flickermood"}`), wantErr: "a track's url isn't a spotify link"},
		{name: "artwork from anywhere else", body: night(`{` + spotify + `,"artworkUrl":"https://tracker.example/pixel.gif"}`), wantErr: "a track's artworkUrl isn't its cover art"},
		{name: "unknown source", body: night(`{"source":"tidal","externalId":"1","title":"Track"}`), wantErr: "unknown track source"},
		{name: "note too long", body: night(`{"source":"manual","note":"` + strings.Repeat("a", 501) + `"}`), wantErr: "a track's note is too long"},
		{name: "slur in a note", body: night(`{"source":"manual","title":"Track","note":"what a f4ggot"}`), wantErr: "that includes language that isn't allowed on Beatboxd"},
		{name: "too many", body: night(strings.TrimSuffix(strings.Repeat(`{"source":"manual","title":"T"},`, maxTracks+1), ",")), wantErr: "too many tracks"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req createReviewRequest
			if err := json.Unmarshal([]byte(tc.body), &req); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			v, errMsg := req.validate()
			if errMsg != tc.wantErr {
				t.Fatalf("error = %q, want %q", errMsg, tc.wantErr)
			}
			if tc.wantErr == "" && len(v.tracks) != len(req.Tracks) {
				t.Fatalf("tracks = %d, want %d", len(v.tracks), len(req.Tracks))
			}
		})
	}
}
