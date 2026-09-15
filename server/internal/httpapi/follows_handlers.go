package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db/queries"
)

func (h *Handlers) IsFollowing(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		Unauthorized(w)
		return
	}
	targetID := chi.URLParam(r, "userId")

	following, err := queries.IsFollowing(r.Context(), h.Pool, user.ID, targetID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"following": following})
}
