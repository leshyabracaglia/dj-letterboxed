package httpapi

import (
	"encoding/json"
	"testing"
)

// TestTaggedUserIDs_UndefinedVsEmptyVsSet locks in the wire-format contract
// that setReviewTags in reviews.ts relied on: omitted = leave tags
// untouched, [] = clear all tags, non-empty = replace. A *[]string field
// is what preserves this distinction across JSON decode in Go (a plain
// []string can't tell "omitted" from "empty" — both decode to nil/zero).
func TestTaggedUserIDs_UndefinedVsEmptyVsSet(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantNil   bool
		wantEmpty bool
		wantLen   int
	}{
		{name: "field omitted", body: `{"djId":"x","seenAt":"2026-01-01T00:00:00Z"}`, wantNil: true},
		{name: "field is empty array", body: `{"djId":"x","seenAt":"2026-01-01T00:00:00Z","taggedUserIds":[]}`, wantEmpty: true},
		{name: "field has values", body: `{"djId":"x","seenAt":"2026-01-01T00:00:00Z","taggedUserIds":["a","b"]}`, wantLen: 2},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req createReviewRequest
			if err := json.Unmarshal([]byte(tc.body), &req); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}

			if tc.wantNil {
				if req.TaggedUserIDs != nil {
					t.Fatalf("expected nil (omitted = leave untouched), got %+v", req.TaggedUserIDs)
				}
				return
			}

			if req.TaggedUserIDs == nil {
				t.Fatalf("expected non-nil pointer, got nil")
			}
			if tc.wantEmpty && len(*req.TaggedUserIDs) != 0 {
				t.Fatalf("expected empty slice (= clear all), got %+v", *req.TaggedUserIDs)
			}
			if tc.wantLen > 0 && len(*req.TaggedUserIDs) != tc.wantLen {
				t.Fatalf("expected %d ids, got %+v", tc.wantLen, *req.TaggedUserIDs)
			}
		})
	}
}
