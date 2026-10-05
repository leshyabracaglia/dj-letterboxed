package httpapi

import (
	"testing"
	"time"
)

func TestParseSeenAt(t *testing.T) {
	now := time.Date(2026, 10, 5, 9, 0, 0, 0, time.UTC)
	cases := []struct {
		name   string
		in     string
		wantOK bool
	}{
		{name: "past", in: "2026-09-01T12:00:00Z", wantOK: true},
		// Midday local today, ahead of the server's now - still today.
		{name: "later today", in: "2026-10-05T12:00:00+02:00", wantOK: true},
		{name: "next week", in: "2026-10-12T12:00:00Z", wantOK: false},
		{name: "not RFC3339", in: "2026-10-01", wantOK: false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, errMsg := parseSeenAt(c.in, now)
			if ok := errMsg == ""; ok != c.wantOK {
				t.Errorf("parseSeenAt(%q) errMsg = %q, want ok=%v", c.in, errMsg, c.wantOK)
			}
		})
	}
}
