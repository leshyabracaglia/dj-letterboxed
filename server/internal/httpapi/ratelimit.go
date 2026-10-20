package httpapi

import (
	"net"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/httprate"
)

// Rate limits, counted in memory on the one API instance (so they reset on
// a deploy). Every request is limited per client IP; signed-in writes, and
// the endpoints that are billed or create shared records, are also limited
// per user. Over a limit is a 429 with Retry-After.

// clientIP sets r.RemoteAddr to the caller's IP, which in production is the
// rightmost X-Forwarded-For entry: Caddy, the one proxy in front of the API,
// replaces whatever X-Forwarded-For the client sent with the address it saw.
// Unlike chi's RealIP, it ignores True-Client-IP and X-Real-IP, which Caddy
// passes through from the client untouched. With no X-Forwarded-For (local
// dev, no proxy) RemoteAddr is already the caller.
func clientIP(next http.Handler) http.Handler {
	return middleware.ClientIPFromXFF()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ip := middleware.GetClientIP(r.Context()); ip != "" {
			r.RemoteAddr = ip
		}
		next.ServeHTTP(w, r)
	}))
}

func keyByIP(r *http.Request) (string, error) {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	return httprate.CanonicalizeIP(ip), nil
}

// keyByUser keys on the signed-in user, falling back to the IP for routes
// that aren't behind RequireAuth.
func keyByUser(r *http.Request) (string, error) {
	if user, ok := UserFromContext(r.Context()); ok {
		return "user:" + user.ID, nil
	}
	return keyByIP(r)
}

func rateLimited(w http.ResponseWriter, r *http.Request) {
	WriteError(w, http.StatusTooManyRequests, "RATE_LIMITED", "you're doing that too much, try again in a bit")
}

func limitByIP(n int, window time.Duration) func(http.Handler) http.Handler {
	return httprate.LimitBy(n, window, keyByIP, httprate.WithLimitHandler(rateLimited))
}

func limitByUser(n int, window time.Duration) func(http.Handler) http.Handler {
	return httprate.LimitBy(n, window, keyByUser, httprate.WithLimitHandler(rateLimited))
}

// writesOnly applies limit to everything but GET (and HEAD) requests.
func writesOnly(limit func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		limited := limit(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet || r.Method == http.MethodHead {
				next.ServeHTTP(w, r)
				return
			}
			limited.ServeHTTP(w, r)
		})
	}
}
