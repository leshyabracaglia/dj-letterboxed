package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type errorEnvelope struct {
	Error apiError `json:"error"`
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode response", "error", err)
	}
}

func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, errorEnvelope{Error: apiError{Code: code, Message: message}})
}

func NotFound(w http.ResponseWriter) {
	WriteError(w, http.StatusNotFound, "NOT_FOUND", "not found")
}

func Unauthorized(w http.ResponseWriter) {
	WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
}

func BadRequest(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusBadRequest, "BAD_REQUEST", message)
}

func InternalError(w http.ResponseWriter, err error) {
	slog.Error("internal error", "error", err)
	WriteError(w, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", "something went wrong")
}

func DecodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	return dec.Decode(v)
}
