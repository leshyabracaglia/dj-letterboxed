package httpapi

import (
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

const rfc3339 = time.RFC3339

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// uuidParam reads a uuid path param, writing a 404 and returning ok=false
// if it isn't one: a malformed id can't name anything, and would otherwise
// reach Postgres as a type error and come back as a 500.
func uuidParam(w http.ResponseWriter, r *http.Request, name string) (string, bool) {
	id := chi.URLParam(r, name)
	if !uuidPattern.MatchString(id) {
		NotFound(w)
		return "", false
	}
	return id, true
}

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
// nil (no cursor) if absent or unparseable, so a bad cursor just starts
// from the first page.
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

// requireQueryParam reads a required query param, writing a 400 and
// returning ok=false if it's missing.
func requireQueryParam(w http.ResponseWriter, r *http.Request, name string) (string, bool) {
	v := r.URL.Query().Get(name)
	if v == "" {
		BadRequest(w, name+" is required")
		return "", false
	}
	return v, true
}
