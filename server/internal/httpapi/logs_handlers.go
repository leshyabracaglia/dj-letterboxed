package httpapi

import (
	"errors"
	"net/http"
	"time"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

const maxLineup = 30

type nightReviewInput struct {
	Rating     int16   `json:"rating"`
	ReviewText *string `json:"reviewText"`
}

type djReviewInput struct {
	DjID       string  `json:"djId"`
	Rating     int16   `json:"rating"`
	ReviewText *string `json:"reviewText"`
}

// One night out: where and when, who played, and the reviews written about
// it. The venue fields work as in createEventRequest. The series is given
// by seriesId (an existing one) or seriesName (found or created by name);
// neither means a night at the venue with no event name.
type createNightLogRequest struct {
	SeriesID          *string `json:"seriesId"`
	SeriesName        *string `json:"seriesName"`
	Venue             string  `json:"venue"`
	VenueID           *string `json:"venueId"`
	PlaceID           *string `json:"placeId"`
	PlaceSessionToken *string `json:"placeSessionToken"`
	City              *string `json:"city"`
	SeenAt            string  `json:"seenAt"`
	// When the party ran: day, night, or both. Neither given means night.
	IsDay   bool `json:"isDay"`
	IsNight bool `json:"isNight"`
	// DJs the user saw; added to the night's lineup. DJs in djReviews are
	// added too, whether or not they're listed here.
	LineupDjIDs []string `json:"lineupDjIds"`
	// Review of the night as a whole. Required unless djReviews has one.
	Night     *nightReviewInput `json:"night"`
	DjReviews []djReviewInput   `json:"djReviews"`
	// Tag names and tagged friends go on the night review, or on every DJ
	// review when there's no night review.
	Tags          []string `json:"tags"`
	TaggedUserIDs []string `json:"taggedUserIds"`
}

func validateRatingAndText(rating int16, text *string) string {
	if rating < 1 || rating > 5 {
		return "rating must be 1-5"
	}
	if text != nil && len(*text) > 5000 {
		return "reviewText too long"
	}
	return ""
}

// validate returns the parsed seenAt, the full lineup (lineupDjIds plus
// reviewed DJs, deduped), and the normalized tag names.
func (req createNightLogRequest) validate() (seenAt time.Time, lineup []string, tagNames []string, errMsg string) {
	t, errMsg := parseSeenAt(req.SeenAt, time.Now())
	if errMsg != "" {
		return time.Time{}, nil, nil, errMsg
	}
	if req.Night == nil && len(req.DjReviews) == 0 {
		return time.Time{}, nil, nil, "review the night or at least one DJ"
	}
	if req.Night != nil {
		if msg := validateRatingAndText(req.Night.Rating, req.Night.ReviewText); msg != "" {
			return time.Time{}, nil, nil, msg
		}
	}

	seen := map[string]bool{}
	for _, id := range req.LineupDjIDs {
		if !uuidPattern.MatchString(id) {
			return time.Time{}, nil, nil, "unknown DJ in lineupDjIds"
		}
		if !seen[id] {
			seen[id] = true
			lineup = append(lineup, id)
		}
	}
	reviewed := map[string]bool{}
	for _, dr := range req.DjReviews {
		if !uuidPattern.MatchString(dr.DjID) {
			return time.Time{}, nil, nil, "unknown DJ in djReviews"
		}
		if reviewed[dr.DjID] {
			return time.Time{}, nil, nil, "one review per DJ"
		}
		reviewed[dr.DjID] = true
		if msg := validateRatingAndText(dr.Rating, dr.ReviewText); msg != "" {
			return time.Time{}, nil, nil, msg
		}
		if !seen[dr.DjID] {
			seen[dr.DjID] = true
			lineup = append(lineup, dr.DjID)
		}
	}
	if len(lineup) > maxLineup {
		return time.Time{}, nil, nil, "lineup too long"
	}

	tagNames, err := domain.NormalizeTags(req.Tags)
	if err != nil {
		return time.Time{}, nil, nil, err.Error()
	}
	return t, lineup, tagNames, ""
}

// CreateNightLog godoc
//
//	@Summary	Log a night: find or create the night, add DJs to its lineup, and save the night and DJ reviews in one go
//	@Tags		logs
//	@Accept		json
//	@Produce	json
//	@Param		body	body		createNightLogRequest	true	"the night to log"
//	@Success	200		{object}	NightLogResponse
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/logs [post]
func (h *Handlers) CreateNightLog(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	var req createNightLogRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	seenAt, lineup, tagNames, errMsg := req.validate()
	if errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	djs, err := queries.GetDjsByIDs(ctx, h.Pool, lineup)
	if err != nil {
		InternalError(w, err)
		return
	}
	if len(djs) != len(lineup) {
		BadRequest(w, "unknown DJ")
		return
	}

	// Saving a Google place calls out to Google, so it happens before the
	// transaction opens (a saved venue is harmless if the rest fails).
	venue, err := h.resolveVenue(ctx, createEventRequest{
		Venue: req.Venue, VenueID: req.VenueID, PlaceID: req.PlaceID,
		PlaceSessionToken: req.PlaceSessionToken, City: req.City,
	}, user.ID)
	if err != nil {
		writeResolveError(w, err)
		return
	}

	tx, err := h.Pool.Begin(ctx)
	if err != nil {
		InternalError(w, err)
		return
	}
	defer tx.Rollback(ctx)

	series, err := resolveSeries(ctx, tx, req.SeriesID, req.SeriesName, user.ID)
	if err != nil {
		writeResolveError(w, err)
		return
	}
	var seriesID *string
	name := venue.Name
	if series != nil {
		seriesID = &series.ID
		name = series.Name
	}

	isNight := req.IsNight || !req.IsDay
	event, err := queries.GetNight(ctx, tx, seriesID, venue.ID, seenAt, req.IsDay, isNight)
	if errors.Is(err, queries.ErrNotFound) {
		city := req.City
		if city == nil || *city == "" {
			city = venue.City
		}
		event, err = queries.CreateEvent(ctx, tx, name, seriesID, venue, city, seenAt, req.IsDay, isNight, nil, user.ID)
	}
	if err != nil {
		InternalError(w, err)
		return
	}

	if err := queries.AddToLineup(ctx, tx, event.ID, lineup, user.ID); err != nil {
		InternalError(w, err)
		return
	}

	var reviews []db.Review
	create := func(djID *string, rating int16, text *string) error {
		review, err := queries.CreateReview(ctx, tx, queries.CreateReviewParams{
			UserID: user.ID, DjID: djID, EventID: &event.ID,
			Rating: &rating, ReviewText: text, SeenAt: seenAt,
		})
		if err != nil {
			return err
		}
		reviews = append(reviews, *review)
		return nil
	}
	if req.Night != nil {
		if err := create(nil, req.Night.Rating, req.Night.ReviewText); err != nil {
			InternalError(w, err)
			return
		}
	}
	for _, dr := range req.DjReviews {
		djID := dr.DjID
		if err := create(&djID, dr.Rating, dr.ReviewText); err != nil {
			InternalError(w, err)
			return
		}
	}

	// The night review carries the night's tags and friends; without one,
	// each DJ review does so they aren't dropped.
	tagTargets := reviews
	if req.Night != nil {
		tagTargets = reviews[:1]
	}
	for _, review := range tagTargets {
		if len(req.TaggedUserIDs) > 0 {
			if err := queries.SetReviewTags(ctx, tx, review.ID, req.TaggedUserIDs); err != nil {
				InternalError(w, err)
				return
			}
		}
		if len(tagNames) > 0 {
			if err := queries.SetReviewTagLinks(ctx, tx, review.ID, user.ID, tagNames); err != nil {
				InternalError(w, err)
				return
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, NightLogResponse{Event: *event, Series: series, Reviews: reviews})
}

// writeResolveError reports a resolveVenue/resolveSeries failure: bad input
// as a 400, Places being unconfigured as a 503, anything else as a 500.
func writeResolveError(w http.ResponseWriter, err error) {
	var inputErr errVenueInput
	switch {
	case errors.As(err, &inputErr):
		BadRequest(w, inputErr.msg)
	case errors.Is(err, domain.ErrPlacesNotConfigured):
		WriteError(w, http.StatusServiceUnavailable, "UNAVAILABLE", "place search is not configured")
	default:
		InternalError(w, err)
	}
}
