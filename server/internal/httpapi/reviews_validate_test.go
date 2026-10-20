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
			_, lineup, _, errMsg := req.validate()
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
