package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestClientIPIgnoresSpoofableHeaders(t *testing.T) {
	var got string
	h := clientIP(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { got = r.RemoteAddr }))

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "172.18.0.3:41234" // Caddy
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	r.Header.Set("True-Client-IP", "9.9.9.9")
	r.Header.Set("X-Real-IP", "8.8.8.8")
	h.ServeHTTP(httptest.NewRecorder(), r)
	if got != "1.2.3.4" {
		t.Errorf("behind the proxy: got %q, want the X-Forwarded-For address", got)
	}

	r = httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "5.6.7.8:5000"
	h.ServeHTTP(httptest.NewRecorder(), r)
	if got != "5.6.7.8:5000" {
		t.Errorf("no proxy: got %q, want RemoteAddr untouched", got)
	}
}

func TestWritesOnlyLimitsWrites(t *testing.T) {
	h := writesOnly(limitByIP(1, time.Minute))(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	do := func(method string) int {
		r := httptest.NewRequest(method, "/", nil)
		r.RemoteAddr = "1.2.3.4:1"
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec.Code
	}
	for _, want := range []struct {
		method string
		code   int
	}{
		{http.MethodPost, http.StatusOK},
		{http.MethodGet, http.StatusOK},
		{http.MethodGet, http.StatusOK},
		{http.MethodPost, http.StatusTooManyRequests},
	} {
		if code := do(want.method); code != want.code {
			t.Errorf("%s: got %d, want %d", want.method, code, want.code)
		}
	}
}
