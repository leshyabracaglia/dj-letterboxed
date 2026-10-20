package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

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
