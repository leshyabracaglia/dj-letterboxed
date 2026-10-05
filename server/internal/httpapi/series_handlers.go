package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// ListSeries godoc
//
//	@Summary	List event series (recurring events like "Innervisions"), most-reviewed first
//	@Tags		series
//	@Produce	json
//	@Param		q		query	string	false	"name search; omit to list all"
//	@Param		limit	query	int		false	"max results, 1-50, default 20"
//	@Success	200		{array}	queries.SeriesSummary
//	@Router		/api/series [get]
func (h *Handlers) ListSeries(w http.ResponseWriter, r *http.Request) {
	series, err := queries.ListSeries(r.Context(), h.Pool, strings.TrimSpace(r.URL.Query().Get("q")), queryLimit(r, 20, 50))
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(series))
}

// GetSeriesBySlug godoc
//
//	@Summary	Get an event series with its nights, DJs, venues, and recent reviews
//	@Tags		series
//	@Produce	json
//	@Param		slug	path		string	true	"series slug"
//	@Success	200		{object}	SeriesDetailResponse
//	@Failure	404		{object}	errorEnvelope
//	@Router		/api/series/{slug} [get]
func (h *Handlers) GetSeriesBySlug(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	s, err := queries.GetSeriesSummaryBySlug(ctx, h.Pool, chi.URLParam(r, "slug"))
	series, ok := fetchOr404(w, s, err)
	if !ok {
		return
	}

	nights, err := queries.ListSeriesNights(ctx, h.Pool, series.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	djs, err := queries.ListSeriesDjs(ctx, h.Pool, series.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	venues, err := queries.ListSeriesVenues(ctx, h.Pool, series.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	reviews, err := queries.ListSeriesReviews(ctx, h.Pool, series.ID, 20)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(ctx, reviews, hydrateOpts{
		IncludeUser: true, IncludeDj: true, IncludeEvent: true,
		IncludeEngagement: true, CurrentUserID: optionalUserID(r),
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, SeriesDetailResponse{
		Series:        *series,
		Nights:        orEmpty(nights),
		Djs:           orEmpty(djs),
		Venues:        orEmpty(venues),
		RecentReviews: dtos,
	})
}

// resolveSeries returns the series a log names: an existing one by id, or
// one found or created by name. Neither given means the night isn't part
// of a series (nil, nil).
func resolveSeries(ctx context.Context, q queries.DBTX, id, name *string, userID string) (*db.EventSeries, error) {
	if id != nil && *id != "" {
		if !uuidPattern.MatchString(*id) {
			return nil, errVenueInput{"unknown seriesId"}
		}
		s, err := queries.GetSeriesByID(ctx, q, *id)
		if errors.Is(err, queries.ErrNotFound) {
			return nil, errVenueInput{"unknown seriesId"}
		}
		return s, err
	}
	if name == nil {
		return nil, nil
	}
	trimmed := strings.Join(strings.Fields(*name), " ")
	if trimmed == "" {
		return nil, nil
	}
	if len([]rune(trimmed)) > 160 {
		return nil, errVenueInput{"seriesName max 160 chars"}
	}

	existing, err := queries.GetSeriesByName(ctx, q, trimmed)
	if err == nil || !errors.Is(err, queries.ErrNotFound) {
		return existing, err
	}

	// Two names can slugify alike ("Room 1" / "Room-1"); number the later one.
	base := domain.Slugify(trimmed)
	if base == "" {
		base = "event"
	}
	slug := base
	for n := 2; ; n++ {
		_, err := queries.GetSeriesBySlug(ctx, q, slug)
		if errors.Is(err, queries.ErrNotFound) {
			break
		}
		if err != nil {
			return nil, err
		}
		slug = base + "-" + strconv.Itoa(n)
	}
	return queries.CreateSeries(ctx, q, trimmed, slug, userID)
}
