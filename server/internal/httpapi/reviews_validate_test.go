package httpapi

import (
	"encoding/json"
	"testing"
)

const (
	djA = "11111111-1111-1111-1111-111111111111"
	djB = "22222222-2222-2222-2222-222222222222"
)

// TestCreateReviewValidate covers the logging rules: the night's rating is
// required, ratings are 1-5, a DJ is on the lineup once, and a DJ's review
// text needs a rating.
func TestCreateReviewValidate(t *testing.T) {
	cases := []struct {
		name        string
		body        string
		wantErr     string
		wantLineup  []string
		wantRatedDj string
	}{
		{
			name:    "night not rated",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","lineup":[{"djId":"` + djA + `","rating":5}]}`,
			wantErr: "rate the night",
		},
		{
			name:       "night only, unrated lineup kept",
			body:       `{"seenAt":"2026-10-04T12:00:00Z","rating":4,"lineup":[{"djId":"` + djA + `"},{"djId":"` + djB + `"}]}`,
			wantLineup: []string{djA, djB},
		},
		{
			name:        "a DJ rated",
			body:        `{"seenAt":"2026-10-04T12:00:00Z","rating":4,"lineup":[{"djId":"` + djA + `"},{"djId":"` + djB + `","rating":5,"reviewText":"huge"}]}`,
			wantLineup:  []string{djA, djB},
			wantRatedDj: djB,
		},
		{
			name:    "night rating out of range",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","rating":6}`,
			wantErr: "rating must be 1-5",
		},
		{
			name:    "DJ rating out of range",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","rating":4,"lineup":[{"djId":"` + djA + `","rating":0}]}`,
			wantErr: "rating must be 1-5",
		},
		{
			name:    "DJ listed twice",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","rating":4,"lineup":[{"djId":"` + djA + `","rating":5},{"djId":"` + djA + `"}]}`,
			wantErr: "a DJ is in the lineup twice",
		},
		{
			name:    "DJ text without a rating",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","rating":4,"lineup":[{"djId":"` + djA + `","reviewText":"great"}]}`,
			wantErr: "rate a DJ to review their set",
		},
		{
			name:       "empty DJ text is no text",
			body:       `{"seenAt":"2026-10-04T12:00:00Z","rating":4,"lineup":[{"djId":"` + djA + `","reviewText":""}]}`,
			wantLineup: []string{djA},
		},
		{
			name:    "bad DJ id",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","rating":3,"lineup":[{"djId":"nope"}]}`,
			wantErr: "unknown DJ in lineup",
		},
		{
			name:    "future date",
			body:    `{"seenAt":"2999-01-01T12:00:00Z","rating":3}`,
			wantErr: "seenAt can't be in the future",
		},
		{
			name:    "bad date",
			body:    `{"seenAt":"2026-10-04","rating":3}`,
			wantErr: "seenAt must be an RFC3339 timestamp",
		},
		{
			name:    "a picked event still needs the date",
			body:    `{"eventId":"` + djB + `","rating":3}`,
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
				if rated := e.Rating != nil; rated != (e.DjID == tc.wantRatedDj) {
					t.Fatalf("lineup[%d] rated = %v", i, rated)
				}
				if e.ReviewText != nil && *e.ReviewText == "" {
					t.Fatalf("lineup[%d] kept empty review text", i)
				}
			}
		})
	}
}
