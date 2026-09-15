package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"beatboxd/server/internal/auth"
	"beatboxd/server/internal/domain"
)

type RouterConfig struct {
	Pool                      *pgxpool.Pool
	Verifier                  *auth.Verifier
	Spotify                   *domain.SpotifyClient
	ClerkWebhookSigningSecret string
}

func NewRouter(cfg RouterConfig) http.Handler {
	h := NewHandlers(cfg.Pool, cfg.Spotify)
	a := &Auth{Verifier: cfg.Verifier, Pool: cfg.Pool}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Get("/healthz", func(w http.ResponseWriter, req *http.Request) {
		if err := cfg.Pool.Ping(req.Context()); err != nil {
			WriteError(w, http.StatusServiceUnavailable, "UNAVAILABLE", "database unreachable")
			return
		}
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Post("/api/webhooks/clerk", h.ClerkWebhook(cfg.ClerkWebhookSigningSecret))

	r.Route("/api", func(r chi.Router) {
		// Public (no auth required)
		r.Group(func(r chi.Router) {
			r.Get("/djs/search", h.SearchDjs)
			r.Get("/djs/spotify-search", h.SearchSpotify)
			r.Get("/events/search", h.SearchEvents)
			r.Get("/users/search", h.SearchUsers)
			r.Get("/users/{username}", h.GetUserByUsername)
			r.Get("/users/{username}/stats", h.GetUserStats)
			r.Get("/users/{userId}/followers", h.GetFollowers)
			r.Get("/users/{userId}/following", h.GetFollowing)
			r.Get("/reviews/{id}/comments", h.ListComments)
		})

		// Optional auth (public, but personalizes when a valid token is
		// present) — mirrors resolveOptionalUserId's use in the tRPC routers.
		r.Group(func(r chi.Router) {
			r.Use(a.OptionalAuth)
			r.Get("/djs/{slug}", h.GetDjBySlug)
			r.Get("/djs/{id}/reviews", h.ListReviewsByDj)
			r.Get("/events/{id}", h.GetEventByID)
			r.Get("/reviews/{id}", h.GetReviewByID)
			r.Get("/users/{username}/reviews", h.ListReviewsByUser)
		})

		// Protected (auth required)
		r.Group(func(r chi.Router) {
			r.Use(a.RequireAuth)

			r.Post("/djs", h.CreateDj)
			r.Post("/events", h.CreateEvent)

			r.Get("/follows/is-following/{userId}", h.IsFollowing)
			r.Post("/follows/{userId}", h.Follow)
			r.Delete("/follows/{userId}", h.Unfollow)

			r.Post("/reviews", h.CreateReview)
			r.Patch("/reviews/{id}", h.UpdateReview)
			r.Delete("/reviews/{id}", h.DeleteReview)
			r.Post("/reviews/{id}/like", h.LikeReview)
			r.Delete("/reviews/{id}/like", h.UnlikeReview)
			r.Post("/reviews/{id}/comments", h.AddComment)
			r.Delete("/comments/{id}", h.DeleteComment)

			r.Get("/users/me", h.Me)
			r.Patch("/users/me", h.UpdateProfile)
			r.Get("/leaderboard", h.GetLeaderboard)

			r.Get("/feed", h.GetActivity)
			r.Get("/feed/popular", h.GetPopular)
		})
	})

	return r
}

// corsMiddleware reflects the request origin, matching the hand-rolled
// CORS headers in api/trpc/[trpc].ts (Bearer-token auth, not cookies, so
// reflecting the origin carries no session-fixation risk).
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "authorization, content-type")
		w.Header().Set("Vary", "Origin")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
