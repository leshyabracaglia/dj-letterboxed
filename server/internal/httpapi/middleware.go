package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"beatboxd/server/internal/auth"
	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

type ctxKey int

const (
	ctxKeyUser ctxKey = iota
)

func UserFromContext(ctx context.Context) (*db.User, bool) {
	u, ok := ctx.Value(ctxKeyUser).(*db.User)
	return u, ok
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(h, "Bearer ")
}

type Auth struct {
	Verifier *auth.Verifier
	Pool     *pgxpool.Pool
}

// RequireAuth replicates protectedProcedure from lib/server/trpc.ts: 401 if
// there's no valid token, lazily provision a `users` row on first sight
// (race-safe against the Clerk webhook path), 500 if still unresolvable.
func (a *Auth) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			Unauthorized(w)
			return
		}

		clerkID, err := a.Verifier.VerifyToken(token)
		if err != nil {
			Unauthorized(w)
			return
		}

		user, err := queries.GetUserByClerkID(r.Context(), a.Pool, clerkID)
		if err != nil && !errors.Is(err, queries.ErrNotFound) {
			InternalError(w, err)
			return
		}

		if user == nil {
			fallbackUsername := "user_" + lastN(clerkID, 8)
			user, err = queries.CreateUserFallback(r.Context(), a.Pool, clerkID, fallbackUsername)
			if err != nil {
				InternalError(w, err)
				return
			}
		}

		if user == nil {
			InternalError(w, errors.New("could not resolve user"))
			return
		}

		ctx := context.WithValue(r.Context(), ctxKeyUser, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuth replicates resolveOptionalUserId: personalizes output for a
// logged-in caller without requiring auth. An invalid/missing token, or a
// valid token whose user row hasn't been created yet, simply means no
// personalization — never a 401, and never lazily creates a user.
func (a *Auth) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}

		clerkID, err := a.Verifier.VerifyToken(token)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		user, err := queries.GetUserByClerkID(r.Context(), a.Pool, clerkID)
		if err != nil || user == nil {
			next.ServeHTTP(w, r)
			return
		}

		ctx := context.WithValue(r.Context(), ctxKeyUser, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func lastN(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// mustUser resolves the authenticated user from context, writing a 401 and
// returning ok=false if there isn't one. Routes wired behind RequireAuth
// are always authed here; this only trips for the rare misuse of calling it
// from a route that isn't.
func mustUser(w http.ResponseWriter, r *http.Request) (*db.User, bool) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return nil, false
	}
	return user, true
}

// optionalUserID returns the authenticated caller's user id, or nil if the
// request has no (or an unresolved) authenticated user - for endpoints that
// personalize output for a logged-in caller without requiring auth.
func optionalUserID(r *http.Request) *string {
	user, ok := UserFromContext(r.Context())
	if !ok {
		return nil
	}
	return &user.ID
}
