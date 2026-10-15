package httpapi

import (
	"net/http"

	"beatboxd/server/internal/db/queries"
)

// IsFollowing godoc
//
//	@Summary	Whether the caller follows the given user
//	@Tags		follows
//	@Produce	json
//	@Param		userId	path		string	true	"user id"
//	@Success	200		{object}	FollowingStatusResponse
//	@Failure	401		{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/follows/is-following/{userId} [get]
func (h *Handlers) IsFollowing(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	targetID, ok := uuidParam(w, r, "userId")
	if !ok {
		return
	}

	following, err := queries.IsFollowing(r.Context(), h.Pool, user.ID, targetID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, FollowingStatusResponse{Following: following})
}
