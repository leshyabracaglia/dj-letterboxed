package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

func (h *Handlers) SearchDjs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		BadRequest(w, "q is required")
		return
	}
	djs, err := queries.SearchDjs(r.Context(), h.Pool, q)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, djs)
}

func (h *Handlers) GetDjBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	dj, err := queries.GetDjBySlug(r.Context(), h.Pool, slug)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	agg, err := queries.GetDjAggregate(r.Context(), h.Pool, dj.ID)
	if err != nil {
		InternalError(w, err)
		return
	}

	recent, err := queries.ListReviewsByDj(r.Context(), h.Pool, dj.ID, nil, 25)
	if err != nil {
		InternalError(w, err)
		return
	}
	recentDTOs, err := h.hydrateReviews(r.Context(), recent, hydrateOpts{IncludeUser: true, IncludeEvent: true})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"dj":         dj,
		"avgRating":  agg.AvgRating,
		"logCount":   agg.LogCount,
		"recentLogs": recentDTOs,
	})
}

type createDjRequest struct {
	Name      string   `json:"name"`
	Bio       *string  `json:"bio"`
	Genres    []string `json:"genres"`
	SpotifyID *string  `json:"spotifyId"`
	ImageURL  *string  `json:"imageUrl"`
}

func (h *Handlers) CreateDj(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}

	var req createDjRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || len(req.Name) > 128 {
		BadRequest(w, "name must be 1-128 characters")
		return
	}

	if req.SpotifyID != nil {
		existing, err := queries.GetDjBySpotifyID(r.Context(), h.Pool, *req.SpotifyID)
		if err != nil && !errors.Is(err, queries.ErrNotFound) {
			InternalError(w, err)
			return
		}
		if existing != nil {
			WriteJSON(w, http.StatusOK, existing)
			return
		}
	}

	slug := domain.Slugify(req.Name)
	existing, err := queries.GetDjBySlug(r.Context(), h.Pool, slug)
	if err != nil && !errors.Is(err, queries.ErrNotFound) {
		InternalError(w, err)
		return
	}
	if existing != nil {
		WriteJSON(w, http.StatusOK, existing)
		return
	}

	dj, err := queries.CreateDj(r.Context(), h.Pool, req.Name, slug, req.Bio, req.Genres, req.SpotifyID, req.ImageURL, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, dj)
}

func (h *Handlers) SearchSpotify(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		BadRequest(w, "q is required")
		return
	}
	artists, err := h.Spotify.SearchArtists(q)
	if err != nil {
		// Fail-open: mirrors djs.searchSpotify's behavior of swallowing
		// Spotify errors and returning an empty result instead of a 5xx.
		WriteJSON(w, http.StatusOK, []domain.SpotifyArtist{})
		return
	}
	WriteJSON(w, http.StatusOK, artists)
}

func (h *Handlers) ListReviewsByDj(w http.ResponseWriter, r *http.Request) {
	djID := chi.URLParam(r, "id")
	limit := queryLimit(r, 20, 50)
	cursor := queryTimeCursor(r, "cursor")

	reviews, err := queries.ListReviewsByDj(r.Context(), h.Pool, djID, cursor, limit)
	if err != nil {
		InternalError(w, err)
		return
	}

	var currentUserID *string
	if user, ok := UserFromContext(r.Context()); ok {
		currentUserID = &user.ID
	}

	dtos, err := h.hydrateReviews(r.Context(), reviews, hydrateOpts{
		IncludeUser: true, IncludeEvent: true, IncludeEngagement: true, CurrentUserID: currentUserID,
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	var nextCursor *string
	if len(reviews) == limit {
		s := reviews[len(reviews)-1].SeenAt.Format(rfc3339)
		nextCursor = &s
	}

	WriteJSON(w, http.StatusOK, map[string]any{"items": dtos, "nextCursor": nextCursor})
}
