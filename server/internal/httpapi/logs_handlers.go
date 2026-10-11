package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

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

// One night out: which event (optional), where and when, whether you went
// during the day or at night, who you saw, and what you thought. The event
// is given by eventId (an existing one) or eventName (found or created by
// name); neither means a night with no event name, just the venue. The
// venue is required and given as in venueInput.
type createNightLogRequest struct {
	EventID           *string `json:"eventId"`
	EventName         *string `json:"eventName"`
	Venue             string  `json:"venue"`
	VenueID           *string `json:"venueId"`
	PlaceID           *string `json:"placeId"`
	PlaceSessionToken *string `json:"placeSessionToken"`
	City              *string `json:"city"`
	SeenAt            string  `json:"seenAt"`
	// When you went: day, night, or both. Neither given means night.
	IsDay   bool `json:"isDay"`
	IsNight bool `json:"isNight"`
	// DJs you saw. DJs in djReviews are added too, whether or not they're
	// listed here.
	LineupDjIDs []string `json:"lineupDjIds"`
	// Review of the night as a whole. Required.
	Night     *nightReviewInput `json:"night"`
	DjReviews []djReviewInput   `json:"djReviews"`
	// Tag names and tagged friends go on the night review.
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
	if req.Night == nil {
		return time.Time{}, nil, nil, "rate the night"
	}
	if msg := validateRatingAndText(req.Night.Rating, req.Night.ReviewText); msg != "" {
		return time.Time{}, nil, nil, msg
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
//	@Summary	Log a night out: the event (picked, or found or created by name), venue, day, lineup, and the night and DJ reviews, in one go
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
	venue, err := h.resolveVenue(ctx, venueInput{
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

	event, err := resolveEvent(ctx, tx, req.EventID, req.EventName, user.ID)
	if err != nil {
		writeResolveError(w, err)
		return
	}
	var eventID *string
	if event != nil {
		eventID = &event.ID
	}
	city := req.City
	if city == nil || *city == "" {
		city = venue.City
	}
	log, err := queries.CreateLog(ctx, tx, queries.CreateLogParams{
		UserID: user.ID, EventID: eventID, Venue: venue, City: city,
		SeenAt: seenAt, IsDay: req.IsDay, IsNight: req.IsNight || !req.IsDay,
	})
	if err != nil {
		InternalError(w, err)
		return
	}
	if err := queries.AddLogLineup(ctx, tx, log.ID, lineup); err != nil {
		InternalError(w, err)
		return
	}

	var reviews []db.Review
	create := func(djID *string, rating int16, text *string) error {
		review, err := queries.CreateReview(ctx, tx, queries.CreateReviewParams{
			Log: log, DjID: djID, Rating: &rating, ReviewText: text,
		})
		if err != nil {
			return err
		}
		reviews = append(reviews, *review)
		return nil
	}
	if err := create(nil, req.Night.Rating, req.Night.ReviewText); err != nil {
		InternalError(w, err)
		return
	}
	for _, dr := range req.DjReviews {
		djID := dr.DjID
		if err := create(&djID, dr.Rating, dr.ReviewText); err != nil {
			InternalError(w, err)
			return
		}
	}

	// The night review carries the night's tags and friends.
	night := reviews[0]
	if len(req.TaggedUserIDs) > 0 {
		if err := queries.SetReviewTags(ctx, tx, night.ID, req.TaggedUserIDs); err != nil {
			InternalError(w, err)
			return
		}
	}
	if len(tagNames) > 0 {
		if err := queries.SetReviewTagLinks(ctx, tx, night.ID, user.ID, tagNames); err != nil {
			InternalError(w, err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		InternalError(w, err)
		return
	}

	WriteJSON(w, http.StatusOK, NightLogResponse{Log: *log, Event: event, Reviews: reviews})
}

// writeResolveError reports a resolveVenue/resolveEvent failure: bad input
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

// DeleteNightLog godoc
//
//	@Summary	Delete a night out owned by the caller, with all its reviews (404, never 403, if not owned/found)
//	@Tags		logs
//	@Produce	json
//	@Param		id	path		string	true	"log id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/logs/{id} [delete]
func (h *Handlers) DeleteNightLog(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(id) {
		NotFound(w)
		return
	}
	err := queries.DeleteLog(r.Context(), h.Pool, id, user.ID)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

const maxTaggedUsers = 30

// A log can't be rewritten once it's logged; the friends you tagged as
// being there with you are the one thing that can change.
type updateNightLogRequest struct {
	// Replaces the tagged friends; [] clears them.
	TaggedUserIDs []string `json:"taggedUserIds"`
}

type UpdateNightLogResponse struct {
	TaggedUsers []db.User `json:"taggedUsers"`
}

// UpdateNightLog godoc
//
//	@Summary		Change who was tagged as being at a night out owned by the caller (404, never 403, if not owned/found)
//	@Description	The rest of a log - event, venue, date, lineup, ratings, reviews and tags - is fixed once logged. Tagged friends go on the night review, or on every DJ review when there's no night review.
//	@Tags			logs
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string					true	"log id"
//	@Param			body	body		updateNightLogRequest	true	"who was there"
//	@Success		200		{object}	UpdateNightLogResponse
//	@Failure		400		{object}	errorEnvelope
//	@Failure		401		{object}	errorEnvelope
//	@Failure		404		{object}	errorEnvelope
//	@Security		BearerAuth
//	@Router			/api/logs/{id} [patch]
func (h *Handlers) UpdateNightLog(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(id) {
		NotFound(w)
		return
	}
	var req updateNightLogRequest
	if err := DecodeJSON(r, &req); err != nil || req.TaggedUserIDs == nil {
		BadRequest(w, "taggedUserIds is required")
		return
	}
	userIDs := queries.DedupeStrings(req.TaggedUserIDs)
	if len(userIDs) > maxTaggedUsers {
		BadRequest(w, "too many tagged friends")
		return
	}
	for _, uid := range userIDs {
		if !uuidPattern.MatchString(uid) {
			BadRequest(w, "unknown user in taggedUserIds")
			return
		}
	}
	users, err := queries.GetUsersByIDs(ctx, h.Pool, userIDs)
	if err != nil {
		InternalError(w, err)
		return
	}
	if len(users) != len(userIDs) {
		BadRequest(w, "unknown user in taggedUserIds")
		return
	}

	tx, err := h.Pool.Begin(ctx)
	if err != nil {
		InternalError(w, err)
		return
	}
	defer tx.Rollback(ctx)

	reviewIDs, err := queries.LogTagTargets(ctx, tx, id, user.ID)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	for _, reviewID := range reviewIDs {
		if err := queries.SetReviewTags(ctx, tx, reviewID, userIDs); err != nil {
			InternalError(w, err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		InternalError(w, err)
		return
	}

	tagged := make([]db.User, 0, len(userIDs))
	for _, uid := range userIDs {
		tagged = append(tagged, users[uid])
	}
	WriteJSON(w, http.StatusOK, UpdateNightLogResponse{TaggedUsers: tagged})
}
