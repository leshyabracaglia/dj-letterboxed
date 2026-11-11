package httpapi

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger/v2"

	_ "beatboxd/server/docs" // swagger docs, registered via its init()
	"beatboxd/server/internal/auth"
	"beatboxd/server/internal/domain"
)

type RouterConfig struct {
	Pool                      *pgxpool.Pool
	Verifier                  *auth.Verifier
	Spotify                   *domain.SpotifyClient
	Places                    *domain.PlacesClient
	Push                      *domain.PushClient
	RA                        *domain.RAClient
	Email                     *domain.EmailClient
	WebURL                    string
	ClerkWebhookSigningSecret string
}

func NewRouter(cfg RouterConfig) http.Handler {
	h := NewHandlers(cfg.Pool, cfg.Spotify, cfg.Places, cfg.Push, cfg.RA, cfg.Email, cfg.WebURL)
	a := &Auth{Verifier: cfg.Verifier, Pool: cfg.Pool}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(clientIP)
	r.Use(requestLogger)
	r.Use(middleware.Recoverer)
	r.Use(limitBody(maxBodyBytes))
	r.Use(corsMiddleware)
	// After CORS, so a 429 still reaches the web app readably.
	r.Use(limitByIP(1000, time.Minute))

	r.Get("/healthz", func(w http.ResponseWriter, req *http.Request) {
		if err := cfg.Pool.Ping(req.Context()); err != nil {
			WriteError(w, http.StatusServiceUnavailable, "UNAVAILABLE", "database unreachable")
			return
		}
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Post("/api/webhooks/clerk", h.ClerkWebhook(cfg.ClerkWebhookSigningSecret))

	r.Get("/docs/*", httpSwagger.WrapHandler)

	r.Route("/api", func(r chi.Router) {
		// Public (no auth required)
		r.Group(func(r chi.Router) {
			r.Get("/app-version", h.GetAppVersion)
			r.Get("/djs/search", h.SearchDjs)
			r.With(limitByIP(60, time.Minute)).Get("/djs/spotify-search", h.SearchSpotify)
			r.Get("/events", h.ListEvents)
			r.Get("/venues/search", h.SearchVenues)
			r.Get("/venues/{id}", h.GetVenueByID)
			r.Get("/tags", h.ListTags)
			r.Get("/users/search", h.SearchUsers)
			r.Get("/users/{username}", h.GetUserByUsername)
			r.Get("/users/{username}/stats", h.GetUserStats)
			r.Get("/users/{userId}/followers", h.GetFollowers)
			r.Get("/users/{userId}/following", h.GetFollowing)
		})

		// Optional auth (public, but personalizes when a valid token is
		// present).
		r.Group(func(r chi.Router) {
			r.Use(a.OptionalAuth)
			r.Get("/djs/{slug}", h.GetDjBySlug)
			r.Get("/djs/{id}/reviews", h.ListReviewsByDj)
			r.Get("/events/{slug}", h.GetEventBySlug)
			r.Get("/reviews/{id}", h.GetReviewByID)
			r.Get("/reviews/{id}/comments", h.ListComments)
			r.Get("/users/{username}/reviews", h.ListReviewsByUser)
			r.Get("/users/{username}/favorites", h.GetFavoriteReviews)
			r.Get("/users/{username}/lists", h.ListUserLists)
			r.Get("/lists/{id}", h.GetList)
			r.Get("/tracks/{id}/clip", h.GetTrackClip)
			r.Get("/feed/popular", h.GetPopular)
		})

		// Protected (auth required)
		r.Group(func(r chi.Router) {
			r.Use(a.RequireAuth)
			r.Use(writesOnly(limitByUser(60, time.Minute)))

			r.With(limitByUser(30, time.Hour)).Post("/djs", h.CreateDj)
			// Google calls (Nearby Search; Place Details for a place not
			// saved yet), so capped by the day as well.
			r.With(limitByUser(20, time.Hour), limitByUser(50, 24*time.Hour)).Get("/check-ins/nearby", h.NearbyVenues)
			r.With(limitByUser(30, time.Hour), limitByUser(50, 24*time.Hour)).Post("/check-ins", h.CheckIn)
			r.Group(func(r chi.Router) {
				// These can call Google too (geocoding, matching a venue),
				// cached, but still capped by the day.
				r.Use(limitByUser(60, time.Minute), limitByUser(500, 24*time.Hour))
				r.Get("/ra/areas", h.SearchRAAreas)
				r.Get("/ra/events", h.ListRAEvents)
				r.Get("/ra/events/{id}/match", h.MatchRAEvent)
			})
			// Auth-only (unlike Spotify search) since every call is billed;
			// the daily cap bounds what one account can cost.
			r.With(limitByUser(60, time.Minute), limitByUser(500, 24*time.Hour)).Get("/venues/places-search", h.SearchPlaces)
			// Calls out to Spotify/SoundCloud/Apple/Shazam (cached), so
			// signed in and capped by the day like the others.
			r.Group(func(r chi.Router) {
				r.Use(limitByUser(60, time.Minute), limitByUser(500, 24*time.Hour))
				r.Get("/tracks/search", h.SearchTracks)
				r.Get("/tracks/resolve", h.ResolveTrackLink)
			})
			r.With(limitByUser(60, time.Hour)).Post("/tracks/{id}/suggestions", h.SuggestTrackID)
			r.Post("/track-suggestions/{id}/accept", h.AcceptTrackSuggestion)
			r.Delete("/track-suggestions/{id}", h.DeleteTrackSuggestion)
			r.With(limitByUser(30, time.Hour)).Put("/tracks/{id}/clip", h.PutTrackClip)
			r.Delete("/tracks/{id}/clip", h.DeleteTrackClip)

			r.Get("/follows/is-following/{userId}", h.IsFollowing)
			r.Post("/follows/{userId}", h.Follow)
			r.Delete("/follows/{userId}", h.Unfollow)

			r.With(limitByUser(20, time.Hour)).Post("/reviews", h.CreateReview)
			r.Patch("/reviews/{id}", h.UpdateReview)
			r.Delete("/reviews/{id}", h.DeleteReview)
			r.Post("/reviews/{id}/like", h.LikeReview)
			r.Delete("/reviews/{id}/like", h.UnlikeReview)
			r.With(limitByUser(100, time.Hour)).Post("/reviews/{id}/comments", h.AddComment)
			r.Delete("/comments/{id}", h.DeleteComment)

			r.Get("/users/me", h.Me)
			r.Get("/users/me/blocks", h.ListBlockedUsers)
			r.Post("/users/{userId}/block", h.BlockUser)
			r.Delete("/users/{userId}/block", h.UnblockUser)
			r.With(limitByUser(20, time.Hour)).Post("/reports", h.CreateReport)
			r.Patch("/users/me", h.UpdateProfile)
			r.Get("/users/me/settings", h.GetSettings)
			r.Patch("/users/me/settings", h.UpdateSettings)
			r.Patch("/users/me/favorites", h.SetFavoriteReviews)
			r.Patch("/users/me/favorite-venues", h.SetFavoriteVenues)

			r.With(limitByUser(30, time.Hour)).Post("/lists", h.CreateList)
			r.Patch("/lists/{id}", h.UpdateList)
			r.Delete("/lists/{id}", h.DeleteList)
			r.With(limitByUser(200, time.Hour)).Post("/lists/{id}/items", h.AddListItem)
			r.Delete("/lists/{id}/items/{itemId}", h.RemoveListItem)
			r.Post("/users/me/push-tokens", h.RegisterPushToken)
			r.Delete("/users/me/push-tokens", h.UnregisterPushToken)

			r.Get("/feed", h.GetActivity)

			r.Get("/notifications", h.ListNotifications)
			r.Get("/notifications/unread-count", h.CountUnreadNotifications)
			r.Post("/notifications/seen", h.MarkNotificationsSeen)
		})
	})

	return r
}

// corsMiddleware reflects the request origin (Bearer-token auth, not
// cookies, so reflecting the origin carries no session-fixation risk).
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

// maxBodyBytes is the largest request body the API reads; a review with a
// long text and a big lineup is a few KB.
const maxBodyBytes = 1 << 20

// limitBody makes reading more than n bytes of a request body fail, so a
// huge upload can't tie up memory.
func limitBody(n int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, n)
			next.ServeHTTP(w, r)
		})
	}
}

// requestLogger is chi's request log without query strings, which carry
// people's coordinates (check-ins, the RA search) and what they searched for.
var requestLogger = middleware.RequestLogger(pathOnlyLogFormatter{
	&middleware.DefaultLogFormatter{Logger: log.New(os.Stdout, "", log.LstdFlags)},
})

type pathOnlyLogFormatter struct{ middleware.LogFormatter }

func (f pathOnlyLogFormatter) NewLogEntry(r *http.Request) middleware.LogEntry {
	logged := *r
	logged.RequestURI = r.URL.Path
	return f.LogFormatter.NewLogEntry(&logged)
}
