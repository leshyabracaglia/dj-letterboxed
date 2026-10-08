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

// ListEvents godoc
//
//	@Summary	List or search events (named parties like "Innervisions NY"), most-reviewed first
//	@Tags		events
//	@Produce	json
//	@Param		q		query	string	false	"name search; omit to list all"
//	@Param		limit	query	int		false	"max results, 1-50, default 20"
//	@Success	200		{array}	queries.EventSummary
//	@Router		/api/events [get]
func (h *Handlers) ListEvents(w http.ResponseWriter, r *http.Request) {
	events, err := queries.ListEvents(r.Context(), h.Pool, strings.TrimSpace(r.URL.Query().Get("q")), queryLimit(r, 20, 50))
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(events))
}

// GetEventBySlug godoc
//
//	@Summary	Get an event with its totals, the DJs and venues it's been logged with, and recent reviews
//	@Tags		events
//	@Produce	json
//	@Param		slug	path		string	true	"event slug"
//	@Success	200		{object}	EventDetailResponse
//	@Failure	404		{object}	errorEnvelope
//	@Router		/api/events/{slug} [get]
func (h *Handlers) GetEventBySlug(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	s, err := queries.GetEventSummaryBySlug(ctx, h.Pool, chi.URLParam(r, "slug"))
	event, ok := fetchOr404(w, s, err)
	if !ok {
		return
	}

	djs, err := queries.ListEventDjs(ctx, h.Pool, event.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	venues, err := queries.ListEventVenues(ctx, h.Pool, event.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	reviews, err := queries.ListEventReviews(ctx, h.Pool, event.ID, 30)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(ctx, reviews, hydrateOpts{
		IncludeUser: true, IncludeDj: true, IncludeLog: true,
		IncludeEngagement: true, CurrentUserID: optionalUserID(r),
	})
	if err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, EventDetailResponse{
		Event:         *event,
		Djs:           orEmpty(djs),
		Venues:        orEmpty(venues),
		RecentReviews: dtos,
	})
}

// resolveEvent returns the event a log names: an existing one by id, or one
// found or created by name. Neither given means a night with no event name
// (nil, nil).
func resolveEvent(ctx context.Context, q queries.DBTX, id, name *string, userID string) (*db.Event, error) {
	if id != nil && *id != "" {
		if !uuidPattern.MatchString(*id) {
			return nil, errVenueInput{"unknown eventId"}
		}
		e, err := queries.GetEventByID(ctx, q, *id)
		if errors.Is(err, queries.ErrNotFound) {
			return nil, errVenueInput{"unknown eventId"}
		}
		return e, err
	}
	if name == nil {
		return nil, nil
	}
	trimmed := strings.Join(strings.Fields(*name), " ")
	if trimmed == "" {
		return nil, nil
	}
	if len([]rune(trimmed)) > 160 {
		return nil, errVenueInput{"eventName max 160 chars"}
	}

	existing, err := queries.GetEventByName(ctx, q, trimmed)
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
		_, err := queries.GetEventBySlug(ctx, q, slug)
		if errors.Is(err, queries.ErrNotFound) {
			break
		}
		if err != nil {
			return nil, err
		}
		slug = base + "-" + strconv.Itoa(n)
	}
	return queries.CreateEvent(ctx, q, trimmed, slug, userID)
}
