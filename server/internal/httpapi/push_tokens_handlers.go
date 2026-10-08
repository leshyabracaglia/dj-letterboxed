package httpapi

import (
	"net/http"

	"beatboxd/server/internal/db/queries"
)

type pushTokenRequest struct {
	// An Expo push token (ExponentPushToken[...]).
	Token string `json:"token"`
	// "ios" or "android"; ignored on unregister.
	Platform string `json:"platform"`
}

func (req pushTokenRequest) validToken() bool {
	return req.Token != "" && len(req.Token) <= 255
}

// RegisterPushToken godoc
//
//	@Summary	Register this device's Expo push token for the caller (moves it from any other account)
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		body	body		pushTokenRequest	true	"the device's push token"
//	@Success	200		{object}	SuccessResponse
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/me/push-tokens [post]
func (h *Handlers) RegisterPushToken(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req pushTokenRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if !req.validToken() {
		BadRequest(w, "token is required")
		return
	}
	if req.Platform != "ios" && req.Platform != "android" {
		BadRequest(w, "platform must be ios or android")
		return
	}
	if err := queries.UpsertPushToken(r.Context(), h.Pool, user.ID, req.Token, req.Platform); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}

// UnregisterPushToken godoc
//
//	@Summary	Stop sending the caller's notifications to this device (on sign-out)
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		body	body		pushTokenRequest	true	"the device's push token"
//	@Success	200		{object}	SuccessResponse
//	@Failure	400		{object}	errorEnvelope
//	@Failure	401		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/users/me/push-tokens [delete]
func (h *Handlers) UnregisterPushToken(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req pushTokenRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if !req.validToken() {
		BadRequest(w, "token is required")
		return
	}
	if err := queries.DeletePushToken(r.Context(), h.Pool, user.ID, req.Token); err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, SuccessResponse{Success: true})
}
