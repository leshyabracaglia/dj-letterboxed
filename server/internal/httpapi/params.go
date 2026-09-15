package httpapi

import (
	"net/http"
	"strconv"
	"time"
)

const rfc3339 = time.RFC3339

func queryLimit(r *http.Request, def, max int) int {
	v := r.URL.Query().Get("limit")
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

// queryTimeCursor parses an ISO-8601/RFC3339 cursor query param. Returns
// nil (no cursor) if absent or unparseable — mirrors the defensive cursor
// handling used throughout the ported TS routers.
func queryTimeCursor(r *http.Request, param string) *time.Time {
	v := r.URL.Query().Get(param)
	if v == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil
	}
	return &t
}
