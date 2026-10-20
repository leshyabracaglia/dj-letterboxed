package httpapi

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

const (
	maxLineup      = 30
	maxTaggedUsers = 30
	maxTracks      = 10
)

// seenAtFutureSlack is how far past now a seenAt may land. Clients send
// midday local time on the day picked, so a set logged this morning can
// legitimately be a few hours in the future depending on time zone; a day
// covers every zone while still rejecting sets that haven't happened yet.
const seenAtFutureSlack = 24 * time.Hour

// parseSeenAt parses an RFC3339 seenAt and rejects dates in the future.
func parseSeenAt(s string, now time.Time) (time.Time, string) {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}, "seenAt must be an RFC3339 timestamp"
	}
	if t.After(now.Add(seenAtFutureSlack)) {
		return time.Time{}, "seenAt can't be in the future"
	}
	return t, ""
}

// A DJ you saw, with what you thought of their set (if anything).
type lineupEntryInput struct {
	DjID       string  `json:"djId"`
	ReviewText *string `json:"reviewText,omitempty"`
}

// A track someone highlights on their night (see db.ReviewTrack): djId is
// who played it (on the lineup), or omitted for one from the night they
// can't pin to a DJ. A track from a music service gives its source and
// externalId (with the url and artworkUrl the search or link lookup gave);
// one typed in is source "manual". It needs a title, or a note about an
// unidentified one.
type trackInput struct {
	DjID       *string `json:"djId,omitempty"`
	Source     string  `json:"source"`
	ExternalID *string `json:"externalId,omitempty"`
	URL        *string `json:"url,omitempty"`
	Title      *string `json:"title,omitempty"`
	Artist     *string `json:"artist,omitempty"`
	ArtworkURL *string `json:"artworkUrl,omitempty"`
	Note       *string `json:"note,omitempty"`
}

// validate checks the track against the night's lineup (onLineup) and
// returns it ready to save, or a 400 message.
func (t trackInput) validate(onLineup map[string]bool) (queries.TrackInput, string) {
	in := queries.TrackInput{
		DjID: t.DjID, Source: t.Source, ExternalID: nonEmpty(t.ExternalID), URL: nonEmpty(t.URL),
		Title: nonEmpty(t.Title), Artist: nonEmpty(t.Artist), ArtworkURL: nonEmpty(t.ArtworkURL), Note: nonEmpty(t.Note),
	}
	if in.DjID != nil && !onLineup[*in.DjID] {
		return in, "a track's DJ isn't on the lineup"
	}
	switch in.Source {
	case domain.TrackSourceManual:
		if in.ExternalID != nil || in.URL != nil || in.ArtworkURL != nil {
			return in, "a track typed in can't have a link"
		}
	case domain.TrackSourceSpotify, domain.TrackSourceSoundCloud, domain.TrackSourceApple, domain.TrackSourceShazam:
		if in.ExternalID == nil || len(*in.ExternalID) > 200 {
			return in, "a track from " + in.Source + " needs its externalId"
		}
		if in.URL != nil {
			if link, err := domain.ParseTrackLink(*in.URL); err != nil || link.Source != in.Source {
				return in, "a track's url isn't a " + in.Source + " link"
			}
		}
		if in.ArtworkURL != nil && !domain.IsTrackArtworkURL(*in.ArtworkURL) {
			return in, "a track's artworkUrl isn't its cover art"
		}
	default:
		return in, "unknown track source"
	}
	if in.Title == nil && in.Note == nil {
		return in, "a track needs a title, or a note about it"
	}
	if len(deref(in.Title)) > 200 || len(deref(in.Artist)) > 200 {
		return in, "a track's title or artist is too long"
	}
	if len(deref(in.Note)) > 500 {
		return in, "a track's note is too long"
	}
	return in, ""
}

// nonEmpty is s, or nil when it's missing or blank.
func nonEmpty(s *string) *string {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	return &trimmed
}

// One night out: which event (optional), where and when, whether you went
// during the day or at night, what you thought of it, and who you saw. The
// event is given by eventId (an existing one) or eventName (found or created
// by name); neither means a night with no event name, just the venue. The
// venue is required and given as in venueInput.
type createReviewRequest struct {
	EventID           *string `json:"eventId,omitempty"`
	EventName         *string `json:"eventName,omitempty"`
	Venue             string  `json:"venue,omitempty"`
	VenueID           *string `json:"venueId,omitempty"`
	PlaceID           *string `json:"placeId,omitempty"`
	PlaceSessionToken *string `json:"placeSessionToken,omitempty"`
	City              *string `json:"city,omitempty"`
	SeenAt            string  `json:"seenAt"`
	// When you went: day, night, or both. Neither given means night.
	IsDay   bool `json:"isDay,omitempty"`
	IsNight bool `json:"isNight,omitempty"`
	// What you thought of the night as a whole.
	ReviewText *string            `json:"reviewText,omitempty"`
	Lineup     []lineupEntryInput `json:"lineup"`
	// Tracks they highlighted, in the order to show them.
	Tracks []trackInput `json:"tracks,omitempty"`
	// Descriptive tag names ("packed"), and friends who were there.
	Tags          []string `json:"tags"`
	TaggedUserIDs []string `json:"taggedUserIds"`
}

func validateReviewText(text *string) string {
	if text != nil && len(*text) > 5000 {
		return "reviewText too long"
	}
	return ""
}

// validatedReview is a createReviewRequest checked and ready to save.
type validatedReview struct {
	seenAt   time.Time
	lineup   []queries.LineupInput
	tracks   []queries.TrackInput
	tagNames []string
}

// validate returns the parsed seenAt, the lineup (empty review texts
// dropped), the tracks, and the normalized tag names.
func (req createReviewRequest) validate() (v validatedReview, errMsg string) {
	t, lineup, tagNames, errMsg := req.validateNight()
	if errMsg != "" {
		return v, errMsg
	}
	if len(req.Tracks) > maxTracks {
		return v, "too many tracks"
	}
	onLineup := map[string]bool{}
	for _, e := range lineup {
		onLineup[e.DjID] = true
	}
	tracks := make([]queries.TrackInput, len(req.Tracks))
	var texts []string
	for i, tr := range req.Tracks {
		in, msg := tr.validate(onLineup)
		if msg != "" {
			return v, msg
		}
		tracks[i] = in
		texts = append(texts, deref(in.Title), deref(in.Artist), deref(in.Note))
	}
	if domain.IsObjectionable(texts...) {
		return v, domain.ErrObjectionable.Error()
	}
	return validatedReview{seenAt: t, lineup: lineup, tracks: tracks, tagNames: tagNames}, ""
}

// validateNight checks everything but the tracks.
func (req createReviewRequest) validateNight() (seenAt time.Time, lineup []queries.LineupInput, tagNames []string, errMsg string) {
	t, errMsg := parseSeenAt(req.SeenAt, time.Now())
	if errMsg != "" {
		return time.Time{}, nil, nil, errMsg
	}
	if msg := validateReviewText(req.ReviewText); msg != "" {
		return time.Time{}, nil, nil, msg
	}

	if len(req.Lineup) > maxLineup {
		return time.Time{}, nil, nil, "lineup too long"
	}
	seen := map[string]bool{}
	for _, e := range req.Lineup {
		if !uuidPattern.MatchString(e.DjID) {
			return time.Time{}, nil, nil, "unknown DJ in lineup"
		}
		if seen[e.DjID] {
			return time.Time{}, nil, nil, "a DJ is in the lineup twice"
		}
		seen[e.DjID] = true
		text := e.ReviewText
		if text != nil && *text == "" {
			text = nil
		}
		if msg := validateReviewText(text); msg != "" {
			return time.Time{}, nil, nil, msg
		}
		lineup = append(lineup, queries.LineupInput{DjID: e.DjID, ReviewText: text})
	}

	tagNames, err := domain.NormalizeTags(req.Tags)
	if err != nil {
		return time.Time{}, nil, nil, err.Error()
	}

	texts := append([]string{deref(req.ReviewText), deref(req.EventName), req.Venue, deref(req.City)}, tagNames...)
	for _, e := range lineup {
		texts = append(texts, deref(e.ReviewText))
	}
	if domain.IsObjectionable(texts...) {
		return time.Time{}, nil, nil, domain.ErrObjectionable.Error()
	}
	return t, lineup, tagNames, ""
}

// validateTaggedUsers checks the tagged-friends list callerID sent and
// returns it deduped, with each user's row keyed by id, or a 400 message.
// Nobody blocked either way can be tagged.
func (h *Handlers) validateTaggedUsers(ctx context.Context, callerID string, ids []string) ([]string, map[string]db.User, string, error) {
	ids = queries.DedupeStrings(ids)
	if len(ids) > maxTaggedUsers {
		return nil, nil, "too many tagged friends", nil
	}
	for _, id := range ids {
		if !uuidPattern.MatchString(id) {
			return nil, nil, "unknown user in taggedUserIds", nil
		}
	}
	users, err := queries.GetUsersByIDs(ctx, h.Pool, ids)
	if err != nil {
		return nil, nil, "", err
	}
	if len(users) != len(ids) {
		return nil, nil, "unknown user in taggedUserIds", nil
	}
	hidden, err := queries.HiddenUserIDs(ctx, h.Pool, callerID)
	if err != nil {
		return nil, nil, "", err
	}
	for _, id := range ids {
		if hidden[id] {
			return nil, nil, "you can't tag @" + users[id].Username, nil
		}
	}
	return ids, users, "", nil
}

// CreateReview godoc
//
//	@Summary	Log a night out: the event (picked, or found or created by name), venue, day, review, the DJs seen and anything said about their sets, tracks, tags and friends, in one go
//	@Tags		reviews
//	@Accept		json
//	@Produce	json
//	@Param		body	body		createReviewRequest	true	"the night to log"
//	@Success	200		{object}	ReviewDTO
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews [post]
func (h *Handlers) CreateReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()

	var req createReviewRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	v, errMsg := req.validate()
	if errMsg != "" {
		BadRequest(w, errMsg)
		return
	}
	lineup := v.lineup
	taggedIDs, _, errMsg, err := h.validateTaggedUsers(ctx, user.ID, req.TaggedUserIDs)
	if err != nil {
		InternalError(w, err)
		return
	}
	if errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	djIDs := make([]string, len(lineup))
	for i, e := range lineup {
		djIDs[i] = e.DjID
	}
	djs, err := queries.GetDjsByIDs(ctx, h.Pool, djIDs)
	if err != nil {
		InternalError(w, err)
		return
	}
	if len(djs) != len(djIDs) {
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
	review, err := queries.CreateReview(ctx, tx, queries.CreateReviewParams{
		UserID: user.ID, EventID: eventID, Venue: venue, City: city,
		SeenAt: v.seenAt, IsDay: req.IsDay, IsNight: req.IsNight || !req.IsDay,
		ReviewText: req.ReviewText,
	})
	if err != nil {
		InternalError(w, err)
		return
	}
	if err := queries.AddReviewLineup(ctx, tx, review.ID, lineup); err != nil {
		InternalError(w, err)
		return
	}
	if err := queries.AddReviewTracks(ctx, tx, review.ID, v.tracks); err != nil {
		InternalError(w, err)
		return
	}
	if len(taggedIDs) > 0 {
		if err := queries.SetReviewTags(ctx, tx, review.ID, taggedIDs); err != nil {
			InternalError(w, err)
			return
		}
	}
	if len(v.tagNames) > 0 {
		if err := queries.SetReviewTagLinks(ctx, tx, review.ID, user.ID, v.tagNames); err != nil {
			InternalError(w, err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		InternalError(w, err)
		return
	}
	h.notifyTagged(user, review.ID, taggedIDs)

	dtos, err := h.hydrateReviews(ctx, []db.Review{*review}, &user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, dtos[0])
}

// writeResolveError reports a resolveVenue/resolveEvent failure: bad input
// as a 400, Places being unavailable (no key, or over budget) as a 503, anything else as a 500.
func writeResolveError(w http.ResponseWriter, err error) {
	var inputErr errBadInput
	switch {
	case errors.As(err, &inputErr):
		BadRequest(w, inputErr.msg)
	case domain.PlacesUnavailable(err):
		WriteError(w, http.StatusServiceUnavailable, "UNAVAILABLE", "place search is unavailable right now")
	default:
		InternalError(w, err)
	}
}

// requireOwnedReview loads a review and 404s (never 403) if it doesn't
// exist or isn't owned by the caller — existence and ownership must be
// indistinguishable to the caller.
func (h *Handlers) requireOwnedReview(ctx context.Context, w http.ResponseWriter, id, userID string) (*db.Review, bool) {
	if !uuidPattern.MatchString(id) {
		NotFound(w)
		return nil, false
	}
	review, err := queries.GetReviewByID(ctx, h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) || (review != nil && review.UserID != userID) {
		NotFound(w)
		return nil, false
	}
	if err != nil {
		InternalError(w, err)
		return nil, false
	}
	return review, true
}

// reviewParam loads the review named by the {id} URL param, 404ing if
// there's no such review.
func (h *Handlers) reviewParam(w http.ResponseWriter, r *http.Request) (*db.Review, bool) {
	id, ok := uuidParam(w, r, "id")
	if !ok {
		return nil, false
	}
	review, err := queries.GetReviewByID(r.Context(), h.Pool, id)
	return fetchOr404(w, review, err)
}

// DeleteReview godoc
//
//	@Summary	Delete a night out owned by the caller, with its DJ reviews, likes, comments and tags (404, never 403, if not owned/found)
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id} [delete]
func (h *Handlers) DeleteReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := uuidParam(w, r, "id")
	if !ok {
		return
	}
	err := queries.DeleteReview(r.Context(), h.Pool, id, user.ID)
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

// A review can't be rewritten once it's logged; the friends you tagged as
// being there with you are the one thing that can change.
type updateReviewRequest struct {
	// Replaces the tagged friends; [] clears them.
	TaggedUserIDs []string `json:"taggedUserIds"`
}

type UpdateReviewResponse struct {
	TaggedUsers []db.User `json:"taggedUsers"`
}

// UpdateReview godoc
//
//	@Summary		Change who was tagged as being at a night out owned by the caller (404, never 403, if not owned/found)
//	@Description	The rest of a review - event, venue, date, lineup, text and tags - is fixed once logged.
//	@Tags			reviews
//	@Accept			json
//	@Produce		json
//	@Param			id		path		string				true	"review id"
//	@Param			body	body		updateReviewRequest	true	"who was there"
//	@Success		200		{object}	UpdateReviewResponse
//	@Failure		400		{object}	errorEnvelope
//	@Failure		401		{object}	errorEnvelope
//	@Failure		404		{object}	errorEnvelope
//	@Security		BearerAuth
//	@Router			/api/reviews/{id} [patch]
func (h *Handlers) UpdateReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	id, ok := uuidParam(w, r, "id")
	if !ok {
		return
	}
	var req updateReviewRequest
	if err := DecodeJSON(r, &req); err != nil || req.TaggedUserIDs == nil {
		BadRequest(w, "taggedUserIds is required")
		return
	}
	userIDs, users, errMsg, err := h.validateTaggedUsers(ctx, user.ID, req.TaggedUserIDs)
	if err != nil {
		InternalError(w, err)
		return
	}
	if errMsg != "" {
		BadRequest(w, errMsg)
		return
	}
	if _, ok := h.requireOwnedReview(ctx, w, id, user.ID); !ok {
		return
	}
	if err := queries.SetReviewTags(ctx, h.Pool, id, userIDs); err != nil {
		InternalError(w, err)
		return
	}
	h.notifyTagged(user, id, userIDs)

	tagged := make([]db.User, 0, len(userIDs))
	for _, uid := range userIDs {
		tagged = append(tagged, users[uid])
	}
	WriteJSON(w, http.StatusOK, UpdateReviewResponse{TaggedUsers: tagged})
}

// GetReviewByID godoc
//
//	@Summary	Get a night out with its lineup and DJ reviews, engagement, tags and tagged friends
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	ReviewDTO
//	@Failure	404	{object}	errorEnvelope
//	@Router		/api/reviews/{id} [get]
func (h *Handlers) GetReviewByID(w http.ResponseWriter, r *http.Request) {
	review, ok := h.reviewParam(w, r)
	if !ok {
		return
	}
	currentUserID := optionalUserID(r)

	dtos, err := h.hydrateReviews(r.Context(), []db.Review{*review}, currentUserID)
	if err != nil {
		InternalError(w, err)
		return
	}
	dto := dtos[0]
	if currentUserID != nil && slices.ContainsFunc(dto.TaggedUsers, func(u db.User) bool { return u.ID == *currentUserID }) {
		logged, err := queries.HasLoggedSameNight(r.Context(), h.Pool, *currentUserID, review.ID)
		if err != nil {
			InternalError(w, err)
			return
		}
		dto.ViewerLoggedNight = &logged
	}

	WriteJSON(w, http.StatusOK, dto)
}

// ListReviewsByUser godoc
//
//	@Summary	List a user's nights out, cursor-paginated by seenAt desc
//	@Tags		reviews
//	@Produce	json
//	@Param		username	path		string	true	"username"
//	@Param		cursor		query		string	false	"pagination cursor (RFC3339 seenAt of the last item)"
//	@Param		limit		query		int		false	"page size, 1-50, default 20"
//	@Success	200			{object}	PaginatedReviews
//	@Failure	404			{object}	errorEnvelope
//	@Router		/api/users/{username}/reviews [get]
func (h *Handlers) ListReviewsByUser(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")

	u, err := queries.GetUserByUsername(r.Context(), h.Pool, username)
	user, ok := fetchOr404(w, u, err)
	if !ok {
		return
	}

	limit := queryLimit(r, 20, 50)
	cursor := queryTimeCursor(r, "cursor")

	reviews, err := queries.ListReviewsByUser(r.Context(), h.Pool, user.ID, cursor, limit)
	if err != nil {
		InternalError(w, err)
		return
	}
	h.writeReviewPage(w, r, reviews, nextSeenAtCursor(reviews, limit))
}

// writeReviewPage writes a page of reviews, leaving out any by users hidden
// from the caller.
func (h *Handlers) writeReviewPage(w http.ResponseWriter, r *http.Request, reviews []db.Review, nextCursor *string) {
	dtos, ok := h.visibleReviews(w, r, reviews)
	if !ok {
		return
	}
	WriteJSON(w, http.StatusOK, PaginatedReviews{Items: dtos, NextCursor: nextCursor})
}

// visibleReviews hydrates reviews for the caller, leaving out any by users
// hidden from them; it writes the error itself on failure.
func (h *Handlers) visibleReviews(w http.ResponseWriter, r *http.Request, reviews []db.Review) ([]ReviewDTO, bool) {
	currentUserID := optionalUserID(r)
	hidden, err := h.hiddenUsers(r.Context(), currentUserID)
	if err != nil {
		InternalError(w, err)
		return nil, false
	}
	dtos, err := h.hydrateReviews(r.Context(), withoutHidden(reviews, hidden), currentUserID)
	if err != nil {
		InternalError(w, err)
		return nil, false
	}
	return dtos, true
}

// LikeReview godoc
//
//	@Summary	Like a night out
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Failure	403	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id}/like [post]
func (h *Handlers) LikeReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	review, ok := h.reviewParam(w, r)
	if !ok || h.blockedWith(r.Context(), w, user.ID, review.UserID) {
		return
	}

	isNew, err := queries.LikeReview(r.Context(), h.Pool, review.ID, user.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	if isNew {
		h.notifyLike(user, review.ID)
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// UnlikeReview godoc
//
//	@Summary	Unlike a night out
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"review id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id}/like [delete]
func (h *Handlers) UnlikeReview(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := uuidParam(w, r, "id")
	if !ok {
		return
	}

	if err := queries.UnlikeReview(r.Context(), h.Pool, id, user.ID); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// ListComments godoc
//
//	@Summary	List the comments on a night out, oldest first
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path	string	true	"review id"
//	@Success	200	{array}	db.ReviewComment
//	@Failure	404	{object}	errorEnvelope
//	@Router		/api/reviews/{id}/comments [get]
func (h *Handlers) ListComments(w http.ResponseWriter, r *http.Request) {
	review, ok := h.reviewParam(w, r)
	if !ok {
		return
	}
	comments, err := queries.ListComments(r.Context(), h.Pool, review.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	hidden, err := h.hiddenUsers(r.Context(), optionalUserID(r))
	if err != nil {
		InternalError(w, err)
		return
	}
	visible := make([]db.ReviewComment, 0, len(comments))
	for _, c := range comments {
		if !hidden[c.UserID] {
			visible = append(visible, c)
		}
	}
	WriteJSON(w, http.StatusOK, visible)
}

type addCommentRequest struct {
	Body string `json:"body"`
}

// AddComment godoc
//
//	@Summary	Comment on a night out
//	@Tags		reviews
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string				true	"review id"
//	@Param		body	body		addCommentRequest	true	"comment body"
//	@Success	200		{object}	db.ReviewComment
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Failure	403		{object}	errorEnvelope
//	@Failure	404		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/reviews/{id}/comments [post]
func (h *Handlers) AddComment(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	review, ok := h.reviewParam(w, r)
	if !ok || h.blockedWith(r.Context(), w, user.ID, review.UserID) {
		return
	}

	var req addCommentRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if req.Body == "" || len(req.Body) > 500 {
		BadRequest(w, "body must be 1-500 characters")
		return
	}
	if domain.IsObjectionable(req.Body) {
		BadRequest(w, domain.ErrObjectionable.Error())
		return
	}

	comment, err := queries.AddComment(r.Context(), h.Pool, review.ID, user.ID, req.Body)
	if err != nil {
		InternalError(w, err)
		return
	}
	// Attach the caller's own row directly, avoiding an extra query, so the
	// response has the same shape as ListComments' items.
	comment.User = user
	h.notifyComment(user, comment)

	WriteJSON(w, http.StatusOK, comment)
}

// requireOwnedComment loads a comment and 404s (never 403) if it doesn't
// exist or isn't owned by the caller — same existence/ownership contract as
// requireOwnedReview.
func (h *Handlers) requireOwnedComment(ctx context.Context, w http.ResponseWriter, id, userID string) (*db.ReviewComment, bool) {
	comment, err := queries.GetCommentByID(ctx, h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) || (comment != nil && comment.UserID != userID) {
		NotFound(w)
		return nil, false
	}
	if err != nil {
		InternalError(w, err)
		return nil, false
	}
	return comment, true
}

// DeleteComment godoc
//
//	@Summary	Delete a comment owned by the caller (404, never 403, if not owned/found)
//	@Tags		reviews
//	@Produce	json
//	@Param		id	path		string	true	"comment id"
//	@Success	200	{object}	SuccessResponse
//	@Failure	401	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/comments/{id} [delete]
func (h *Handlers) DeleteComment(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, ok := uuidParam(w, r, "id")
	if !ok {
		return
	}

	if _, ok := h.requireOwnedComment(r.Context(), w, id, user.ID); !ok {
		return
	}

	if err := queries.DeleteComment(r.Context(), h.Pool, id); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}
