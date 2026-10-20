package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// SearchTracks godoc
//
//	@Summary	Search Spotify for tracks to highlight on a night (fails open to [] on Spotify errors)
//	@Tags		tracks
//	@Produce	json
//	@Param		q	query		string	true	"search query"
//	@Success	200	{array}		domain.TrackMatch
//	@Failure	400	{object}	errorEnvelope
//	@Router		/api/tracks/search [get]
func (h *Handlers) SearchTracks(w http.ResponseWriter, r *http.Request) {
	q, ok := requireQueryParam(w, r, "q")
	if !ok {
		return
	}
	tracks, err := h.Tracks.Search(r.Context(), q)
	if err != nil {
		// Typing the track in still works without Spotify.
		slog.Warn("track search failed", "err", err)
		tracks = nil
	}
	WriteJSON(w, http.StatusOK, orEmpty(tracks))
}

// ResolveTrackLink godoc
//
//	@Summary	Read a pasted Spotify, SoundCloud, Apple Music or Shazam track link
//	@Tags		tracks
//	@Produce	json
//	@Param		url	query		string	true	"the pasted link"
//	@Success	200	{object}	domain.TrackMatch
//	@Failure	400	{object}	errorEnvelope	"not a track link from one of those services"
//	@Failure	404	{object}	errorEnvelope	"no such track, or the service couldn't be reached"
//	@Router		/api/tracks/resolve [get]
func (h *Handlers) ResolveTrackLink(w http.ResponseWriter, r *http.Request) {
	raw, ok := requireQueryParam(w, r, "url")
	if !ok {
		return
	}
	track, err := h.Tracks.Resolve(r.Context(), raw)
	switch {
	case errors.Is(err, domain.ErrUnsupportedLink):
		BadRequest(w, err.Error())
	case err != nil:
		if !errors.Is(err, domain.ErrTrackNotFound) {
			slog.Warn("track link lookup failed", "err", err)
		}
		// Either way the app offers to type it in instead.
		WriteError(w, http.StatusNotFound, "NOT_FOUND", domain.ErrTrackNotFound.Error())
	default:
		WriteJSON(w, http.StatusOK, track)
	}
}

// suggestTrackRequest is what someone thinks an unidentified track is: a
// track found by search or a pasted link (with its source and externalId),
// or one typed in (source "manual").
type suggestTrackRequest struct {
	Source     string  `json:"source"`
	ExternalID *string `json:"externalId,omitempty"`
	URL        *string `json:"url,omitempty"`
	Title      string  `json:"title"`
	Artist     *string `json:"artist,omitempty"`
	ArtworkURL *string `json:"artworkUrl,omitempty"`
}

// reviewResponse writes reviewID as the caller sees it, after a change to
// one of its tracks.
func (h *Handlers) reviewResponse(w http.ResponseWriter, r *http.Request, reviewID string, callerID string) {
	review, err := queries.GetReviewByID(r.Context(), h.Pool, reviewID)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(r.Context(), []db.Review{*review}, &callerID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, dtos[0])
}

// SuggestTrackID godoc
//
//	@Summary	Suggest what an unidentified track on someone's night is (an ID request); the night's own poster naming it identifies it straight away
//	@Tags		tracks
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string				true	"track id"
//	@Param		body	body		suggestTrackRequest	true	"the track"
//	@Success	200		{object}	ReviewDTO	"the night, with the suggestion"
//	@Failure	400		{object}	errorEnvelope
//	@Failure	403		{object}	errorEnvelope
//	@Failure	404		{object}	errorEnvelope
//	@Failure	409		{object}	errorEnvelope	"the track's already identified"
//	@Security	BearerAuth
//	@Router		/api/tracks/{id}/suggestions [post]
func (h *Handlers) SuggestTrackID(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	trackID := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(trackID) {
		NotFound(w)
		return
	}
	var req suggestTrackRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	in, msg := trackInput{
		Source: req.Source, ExternalID: req.ExternalID, URL: req.URL,
		Title: &req.Title, Artist: req.Artist, ArtworkURL: req.ArtworkURL,
	}.validate(nil)
	if msg == "" && in.Title == nil {
		msg = "say what the track is"
	}
	if msg != "" {
		BadRequest(w, msg)
		return
	}
	if domain.IsObjectionable(deref(in.Title), deref(in.Artist)) {
		BadRequest(w, domain.ErrObjectionable.Error())
		return
	}

	track, ownerID, err := queries.GetTrack(r.Context(), h.Pool, trackID)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	if track.Title != nil {
		WriteError(w, http.StatusConflict, "ALREADY_IDENTIFIED", "that track's already been named")
		return
	}
	if blocked, err := queries.IsBlockedEitherWay(r.Context(), h.Pool, user.ID, ownerID); err != nil {
		InternalError(w, err)
		return
	} else if blocked {
		blockedError(w)
		return
	}

	suggestionID, err := queries.CreateTrackSuggestion(r.Context(), h.Pool, trackID, user.ID, queries.TrackSuggestionInput{
		Source: in.Source, ExternalID: in.ExternalID, URL: in.URL, Title: *in.Title, Artist: in.Artist, ArtworkURL: in.ArtworkURL,
	})
	if err != nil {
		InternalError(w, err)
		return
	}
	if ownerID == user.ID {
		// Naming your own ID needs no one's say-so.
		if err := queries.AcceptTrackSuggestion(r.Context(), h.Pool, suggestionID); err != nil {
			InternalError(w, err)
			return
		}
	} else {
		h.notifyTrackID(user, ownerID, track.ReviewID, "id_suggested", *in.Title)
	}
	h.reviewResponse(w, r, track.ReviewID, user.ID)
}

// AcceptTrackSuggestion godoc
//
//	@Summary	Accept a suggestion for an unidentified track on the caller's own night: it names the track, crediting whoever suggested it
//	@Tags		tracks
//	@Produce	json
//	@Param		id	path		string	true	"suggestion id"
//	@Success	200	{object}	ReviewDTO	"the night, with the track named"
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/track-suggestions/{id}/accept [post]
func (h *Handlers) AcceptTrackSuggestion(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	s, ok := h.trackSuggestion(w, r)
	if !ok {
		return
	}
	// Only the night's poster names their track; to anyone else it 404s.
	if s.OwnerID != user.ID {
		NotFound(w)
		return
	}
	if err := queries.AcceptTrackSuggestion(r.Context(), h.Pool, s.ID); err != nil {
		InternalError(w, err)
		return
	}
	if s.UserID != user.ID {
		h.notifyTrackID(user, s.UserID, s.ReviewID, "id_accepted", "")
	}
	h.reviewResponse(w, r, s.ReviewID, user.ID)
}

// DeleteTrackSuggestion godoc
//
//	@Summary	Take back a suggestion you made, or turn one down on your own night
//	@Tags		tracks
//	@Produce	json
//	@Param		id	path		string	true	"suggestion id"
//	@Success	200	{object}	ReviewDTO	"the night, without the suggestion"
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/track-suggestions/{id} [delete]
func (h *Handlers) DeleteTrackSuggestion(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	s, ok := h.trackSuggestion(w, r)
	if !ok {
		return
	}
	if s.UserID != user.ID && s.OwnerID != user.ID {
		NotFound(w)
		return
	}
	if err := queries.DeleteTrackSuggestion(r.Context(), h.Pool, s.ID); err != nil {
		InternalError(w, err)
		return
	}
	h.reviewResponse(w, r, s.ReviewID, user.ID)
}

// trackSuggestion loads the suggestion in the path, writing a 404 if it
// doesn't exist.
func (h *Handlers) trackSuggestion(w http.ResponseWriter, r *http.Request) (*queries.TrackSuggestionRef, bool) {
	id := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(id) {
		NotFound(w)
		return nil, false
	}
	s, err := queries.GetTrackSuggestionRef(r.Context(), h.Pool, id)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return nil, false
	}
	if err != nil {
		InternalError(w, err)
		return nil, false
	}
	return s, true
}
