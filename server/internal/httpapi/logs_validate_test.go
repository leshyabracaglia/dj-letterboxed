package httpapi

import (
	"encoding/json"
	"testing"
)

const (
	djA = "11111111-1111-1111-1111-111111111111"
	djB = "22222222-2222-2222-2222-222222222222"
)

// TestNightLogValidate covers the logging rules: the night review is
// required unless a DJ is reviewed, ratings are 1-5, one review per DJ,
// and reviewed DJs join the lineup even when not listed in it.
func TestNightLogValidate(t *testing.T) {
	cases := []struct {
		name       string
		body       string
		wantErr    string
		wantLineup []string
	}{
		{
			name:    "nothing reviewed",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","lineupDjIds":["` + djA + `"]}`,
			wantErr: "review the night or at least one DJ",
		},
		{
			name:       "night only, lineup kept",
			body:       `{"seenAt":"2026-10-04T12:00:00Z","lineupDjIds":["` + djA + `","` + djA + `"],"night":{"rating":4}}`,
			wantLineup: []string{djA},
		},
		{
			name:       "DJ review only joins the lineup",
			body:       `{"seenAt":"2026-10-04T12:00:00Z","lineupDjIds":["` + djA + `"],"djReviews":[{"djId":"` + djB + `","rating":5}]}`,
			wantLineup: []string{djA, djB},
		},
		{
			name:    "night rating out of range",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","night":{"rating":0}}`,
			wantErr: "rating must be 1-5",
		},
		{
			name:    "DJ reviewed twice",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","djReviews":[{"djId":"` + djA + `","rating":5},{"djId":"` + djA + `","rating":3}]}`,
			wantErr: "one review per DJ",
		},
		{
			name:    "bad DJ id",
			body:    `{"seenAt":"2026-10-04T12:00:00Z","lineupDjIds":["nope"],"night":{"rating":3}}`,
			wantErr: "unknown DJ in lineupDjIds",
		},
		{
			name:    "future date",
			body:    `{"seenAt":"2999-01-01T12:00:00Z","night":{"rating":3}}`,
			wantErr: "seenAt can't be in the future",
		},
		{
			name:    "bad date",
			body:    `{"seenAt":"2026-10-04","night":{"rating":3}}`,
			wantErr: "seenAt must be an RFC3339 timestamp",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req createNightLogRequest
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
			for i := range lineup {
				if lineup[i] != tc.wantLineup[i] {
					t.Fatalf("lineup = %v, want %v", lineup, tc.wantLineup)
				}
			}
		})
	}
}
