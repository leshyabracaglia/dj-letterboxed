package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// Referenced only by swag doc comments below (@Success/@Param types) -
// keeps the import resolvable for OpenAPI generation without an unused
// import error.
var _ db.Dj

// SearchDjs godoc
//
//	@Summary	Search DJs by name
//	@Tags		djs
//	@Produce	json
//	@Param		q	query		string	true	"search query"
//	@Success	200	{array}		db.Dj
//	@Failure	400	{object}	errorEnvelope
//	@Router		/api/djs/search [get]
func (h *Handlers) SearchDjs(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
		return
	}
	djs, err := queries.SearchDjs(r.Context(), h.Pool, q)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, djs)
}

// GetDjBySlug godoc
//
//	@Summary	Get a DJ by slug, with rating aggregate and recent reviews
//	@Tags		djs
//	@Produce	json
//	@Param		slug	path		string	true	"DJ slug"
//	@Success	200		{object}	DjDetailResponse
//	@Failure	404		{object}	errorEnvelope
//	@Router		/api/djs/{slug} [get]
func (h *Handlers) GetDjBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	d, err := queries.GetDjBySlug(r.Context(), h.Pool, slug)
	dj, ok := fetchOr404(w, d, err)
	if !ok {
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

	WriteJSON(w, http.StatusOK, DjDetailResponse{
		Dj:            *dj,
		AvgRating:     agg.AvgRating,
		ReviewCount:   agg.ReviewCount,
		RecentReviews: recentDTOs,
	})
}

type createDjRequest struct {
	Name      string   `json:"name"`
	Bio       *string  `json:"bio"`
	Genres    []string `json:"genres"`
	SpotifyID *string  `json:"spotifyId"`
	ImageURL  *string  `json:"imageUrl"`
}

// CreateDj godoc
//
//	@Summary	Create a DJ (or return the existing one, deduped by spotifyId then slug)
//	@Tags		djs
//	@Accept		json
//	@Produce	json
//	@Param		body	body		createDjRequest	true	"DJ to create"
//	@Success	200		{object}	db.Dj
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/djs [post]
func (h *Handlers) CreateDj(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
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

// SearchSpotify godoc
//
//	@Summary	Search Spotify for artists (fails open to [] on Spotify errors)
//	@Tags		djs
//	@Produce	json
//	@Param		q	query		string	true	"search query"
//	@Success	200	{array}		domain.SpotifyArtist
//	@Failure	400	{object}	errorEnvelope
//	@Router		/api/djs/spotify-search [get]
func (h *Handlers) SearchSpotify(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
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

// ListReviewsByDj godoc
//
//	@Summary	List reviews for a DJ, cursor-paginated by seenAt desc
//	@Tags		djs
//	@Produce	json
//	@Param		id		path		string	true	"DJ id"
//	@Param		cursor	query		string	false	"pagination cursor (RFC3339 seenAt of the last item)"
//	@Param		limit	query		int		false	"page size, 1-50, default 20"
//	@Success	200		{object}	PaginatedReviews
//	@Router		/api/djs/{id}/reviews [get]
func (h *Handlers) ListReviewsByDj(w http.ResponseWriter, r *http.Request) {
	djID := chi.URLParam(r, "id")
	limit := queryLimit(r, 20, 50)
	cursor := queryTimeCursor(r, "cursor")

	reviews, err := queries.ListReviewsByDj(r.Context(), h.Pool, djID, cursor, limit)
	if err != nil {
		InternalError(w, err)
		return
	}

	dtos, err := h.hydrateReviews(r.Context(), reviews, hydrateOpts{
		IncludeUser: true, IncludeEvent: true, IncludeEngagement: true, CurrentUserID: optionalUserID(r),
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, PaginatedReviews{Items: dtos, NextCursor: nextSeenAtCursor(reviews, limit)})
}
