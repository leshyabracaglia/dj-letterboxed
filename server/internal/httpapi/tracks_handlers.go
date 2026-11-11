package httpapi

import (
	"bytes"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

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

const (
	// maxClipBytes bounds a clip's upload: 15 seconds of the app's AAC
	// recording is well under it.
	maxClipBytes = 512 << 10
	maxClipMs    = 15_500
)

// clipContentTypes are the recordings the app makes (AAC in an MP4/M4A
// container), which every platform can play back.
var clipContentTypes = map[string]bool{"audio/mp4": true, "audio/m4a": true, "audio/x-m4a": true, "audio/aac": true}

// readClip reads an uploaded clip from the request: an M4A file, by its
// Content-Type and its bytes, of at most maxClipMs (the X-Clip-Duration-Ms
// header) and maxClipBytes. It returns a 400 message if it isn't one.
func readClip(r *http.Request) (audio []byte, durationMs int, errMsg string) {
	contentType := strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0])
	if !clipContentTypes[contentType] {
		return nil, 0, "a clip must be an M4A recording"
	}
	durationMs, err := strconv.Atoi(r.Header.Get("X-Clip-Duration-Ms"))
	if err != nil || durationMs < 1 || durationMs > maxClipMs {
		return nil, 0, "a clip can be at most 15 seconds"
	}
	audio, err = io.ReadAll(io.LimitReader(r.Body, maxClipBytes+1))
	if err != nil {
		return nil, 0, "couldn't read the clip"
	}
	// An MP4/M4A file starts with its "ftyp" box; anything else isn't one,
	// whatever it says it is.
	if len(audio) > maxClipBytes || len(audio) < 12 || string(audio[4:8]) != "ftyp" {
		return nil, 0, "a clip must be an M4A recording of at most 15 seconds"
	}
	return audio, durationMs, ""
}

// clipTrack loads the track in the path for a change to its clip by its
// night's poster; anyone else gets a 404. A track that's been named can't
// take a clip (409).
func (h *Handlers) clipTrack(w http.ResponseWriter, r *http.Request) (*db.ReviewTrack, *db.User, bool) {
	user, ok := mustUser(w, r)
	if !ok {
		return nil, nil, false
	}
	trackID := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(trackID) {
		NotFound(w)
		return nil, nil, false
	}
	track, ownerID, err := queries.GetTrack(r.Context(), h.Pool, trackID)
	if errors.Is(err, queries.ErrNotFound) || (err == nil && ownerID != user.ID) {
		NotFound(w)
		return nil, nil, false
	}
	if err != nil {
		InternalError(w, err)
		return nil, nil, false
	}
	if track.Title != nil {
		WriteError(w, http.StatusConflict, "ALREADY_IDENTIFIED", "that track's already been named")
		return nil, nil, false
	}
	return track, user, true
}

// PutTrackClip godoc
//
//	@Summary	Attach a recording (at most 15 seconds, AAC in MP4/M4A) to an unidentified track on the caller's own night, replacing any; the body is the audio
//	@Tags		tracks
//	@Accept		audio/mp4
//	@Produce	json
//	@Param		id					path		string	true	"track id"
//	@Param		X-Clip-Duration-Ms	header		int		true	"the recording's length"
//	@Success	200					{object}	ReviewDTO	"the night, with the clip"
//	@Failure	400					{object}	errorEnvelope
//	@Failure	404					{object}	errorEnvelope
//	@Failure	409					{object}	errorEnvelope	"the track's already identified"
//	@Security	BearerAuth
//	@Router		/api/tracks/{id}/clip [put]
func (h *Handlers) PutTrackClip(w http.ResponseWriter, r *http.Request) {
	track, user, ok := h.clipTrack(w, r)
	if !ok {
		return
	}
	audio, durationMs, msg := readClip(r)
	if msg != "" {
		BadRequest(w, msg)
		return
	}
	if err := queries.SetTrackClip(r.Context(), h.Pool, track.ID, "audio/mp4", audio, int32(durationMs)); err != nil {
		InternalError(w, err)
		return
	}
	h.reviewResponse(w, r, track.ReviewID, user.ID)
}

// DeleteTrackClip godoc
//
//	@Summary	Remove the recording from an unidentified track on the caller's own night
//	@Tags		tracks
//	@Produce	json
//	@Param		id	path		string	true	"track id"
//	@Success	200	{object}	ReviewDTO	"the night, without the clip"
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/tracks/{id}/clip [delete]
func (h *Handlers) DeleteTrackClip(w http.ResponseWriter, r *http.Request) {
	track, user, ok := h.clipTrack(w, r)
	if !ok {
		return
	}
	if err := queries.DeleteTrackClip(r.Context(), h.Pool, track.ID); err != nil {
		InternalError(w, err)
		return
	}
	h.reviewResponse(w, r, track.ReviewID, user.ID)
}

// GetTrackClip godoc
//
//	@Summary	Stream an unidentified track's recording (inline, for the app's player; supports Range requests)
//	@Tags		tracks
//	@Produce	audio/mp4
//	@Param		id	path	string	true	"track id"
//	@Success	200
//	@Failure	404	{object}	errorEnvelope
//	@Router		/api/tracks/{id}/clip [get]
func (h *Handlers) GetTrackClip(w http.ResponseWriter, r *http.Request) {
	trackID := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(trackID) {
		NotFound(w)
		return
	}
	clip, err := queries.GetTrackClip(r.Context(), h.Pool, trackID)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	hidden, err := h.hiddenUsers(r.Context(), optionalUserID(r))
	if err != nil {
		InternalError(w, err)
		return
	}
	if hidden[clip.OwnerID] {
		NotFound(w)
		return
	}
	w.Header().Set("Content-Type", clip.ContentType)
	// Played in place, not saved: no filename, and not kept in shared caches.
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Cache-Control", "private, max-age=300")
	// ServeContent answers the Range requests iOS's player makes.
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(clip.Audio))
}
