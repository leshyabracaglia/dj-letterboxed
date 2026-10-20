package httpapi

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
)

func TestRequestLogOmitsQuery(t *testing.T) {
	var buf bytes.Buffer
	logger := middleware.RequestLogger(pathOnlyLogFormatter{
		&middleware.DefaultLogFormatter{Logger: log.New(&buf, "", 0), NoColor: true},
	})
	h := logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/check-ins/nearby?lat=52.5&lng=13.4", nil))
	if out := buf.String(); !strings.Contains(out, "/api/check-ins/nearby") || strings.Contains(out, "52.5") {
		t.Errorf("log line = %q, want the path without the query", out)
	}
}

func TestLimitBody(t *testing.T) {
	var readErr error
	h := limitBody(10)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/", strings.NewReader(strings.Repeat("x", 11))))
	if readErr == nil {
		t.Error("reading an 11-byte body under a 10-byte limit succeeded")
	}
}
