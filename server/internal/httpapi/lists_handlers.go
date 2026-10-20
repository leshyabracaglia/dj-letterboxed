package httpapi

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/go-chi/chi/v5"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

const (
	maxListsPerUser = 50
	maxListItems    = 100
)

type ListItemDTO struct {
	queries.ListItem
	// The night it's from, as the app shows it.
	Review ReviewDTO `json:"review"`
}

type ListDetailResponse struct {
	queries.List
	User  db.User       `json:"user"`
	Items []ListItemDTO `json:"items"`
}

type listRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
}

// validate returns the trimmed title and description, or a 400 message.
func (req listRequest) validate() (string, *string, string) {
	title := strings.TrimSpace(req.Title)
	description := nonEmpty(req.Description)
	switch {
	case title == "":
		return "", nil, "give the list a title"
	case len(title) > 100:
		return "", nil, "title too long"
	case len(deref(description)) > 1000:
		return "", nil, "description too long"
	case domain.IsObjectionable(title, deref(description)):
		return "", nil, domain.ErrObjectionable.Error()
	}
	return title, description, ""
}

// ListUserLists godoc
//
//	@Summary	A user's lists, most recently changed first; with reviewId, whether that night is on each
//	@Tags		lists
//	@Produce	json
//	@Param		username	path		string	true	"username"
//	@Param		reviewId	query		string	false	"a night to check each list for"
//	@Success	200			{array}		queries.ListSummary
//	@Failure	404			{object}	errorEnvelope
//	@Router		/api/users/{username}/lists [get]
func (h *Handlers) ListUserLists(w http.ResponseWriter, r *http.Request) {
	u, err := queries.GetUserByUsername(r.Context(), h.Pool, chi.URLParam(r, "username"))
	user, ok := fetchOr404(w, u, err)
	if !ok {
		return
	}
	var reviewID *string
	if id := r.URL.Query().Get("reviewId"); uuidPattern.MatchString(id) {
		reviewID = &id
	}
	lists, err := queries.ListsByUser(r.Context(), h.Pool, user.ID, reviewID)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(lists))
}

// GetList godoc
//
//	@Summary	A list, who made it, and its nights and sets in order
//	@Tags		lists
//	@Produce	json
//	@Param		id	path		string	true	"list id"
//	@Success	200	{object}	ListDetailResponse
//	@Failure	404	{object}	errorEnvelope
//	@Router		/api/lists/{id} [get]
func (h *Handlers) GetList(w http.ResponseWriter, r *http.Request) {
	callerID := optionalUserID(r)
	hidden, err := h.hiddenUsers(r.Context(), callerID)
	if err != nil {
		InternalError(w, err)
		return
	}
	list, ok := h.listOr404(w, r)
	if !ok {
		return
	}
	if hidden[list.UserID] {
		NotFound(w)
		return
	}
	owner, err := queries.GetUserByID(r.Context(), h.Pool, list.UserID)
	if err != nil {
		InternalError(w, err)
		return
	}
	items, err := queries.GetListItems(r.Context(), h.Pool, list.ID)
	if err != nil {
		InternalError(w, err)
		return
	}
	reviewIDs := queries.DedupeStrings(mapItems(items, func(i queries.ListItem) string { return i.ReviewID }))
	reviews, err := queries.GetReviewsByIDsOrdered(r.Context(), h.Pool, reviewIDs)
	if err != nil {
		InternalError(w, err)
		return
	}
	dtos, err := h.hydrateReviews(r.Context(), withoutHidden(reviews, hidden), callerID)
	if err != nil {
		InternalError(w, err)
		return
	}
	byID := make(map[string]ReviewDTO, len(dtos))
	for _, d := range dtos {
		byID[d.ID] = d
	}
	out := make([]ListItemDTO, 0, len(items))
	for _, item := range items {
		if review, ok := byID[item.ReviewID]; ok {
			out = append(out, ListItemDTO{ListItem: item, Review: review})
		}
	}
	WriteJSON(w, http.StatusOK, ListDetailResponse{List: *list, User: *owner, Items: out})
}

// CreateList godoc
//
//	@Summary	Start a list
//	@Tags		lists
//	@Accept		json
//	@Produce	json
//	@Param		body	body		listRequest	true	"title and optional description"
//	@Success	200		{object}	queries.List
//	@Failure	400		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/lists [post]
func (h *Handlers) CreateList(w http.ResponseWriter, r *http.Request) {
	user, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req listRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	title, description, msg := req.validate()
	if msg != "" {
		BadRequest(w, msg)
		return
	}
	if n, err := queries.CountListsByUser(r.Context(), h.Pool, user.ID); err != nil {
		InternalError(w, err)
		return
	} else if n >= maxListsPerUser {
		BadRequest(w, "you've got as many lists as you can have")
		return
	}
	list, err := queries.CreateList(r.Context(), h.Pool, user.ID, title, description)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, list)
}

// UpdateList godoc
//
//	@Summary	Rename a list of your own, or change its description
//	@Tags		lists
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string		true	"list id"
//	@Param		body	body		listRequest	true	"title and optional description"
//	@Success	200		{object}	queries.List
//	@Failure	400		{object}	errorEnvelope
//	@Failure	404		{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/lists/{id} [patch]
func (h *Handlers) UpdateList(w http.ResponseWriter, r *http.Request) {
	list, ok := h.ownListOr404(w, r)
	if !ok {
		return
	}
	var req listRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	title, description, msg := req.validate()
	if msg != "" {
		BadRequest(w, msg)
		return
	}
	updated, err := queries.UpdateList(r.Context(), h.Pool, list.ID, title, description)
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, updated)
}

// DeleteList godoc
//
//	@Summary	Delete a list of your own (the nights on it stay)
//	@Tags		lists
//	@Param		id	path	string	true	"list id"
//	@Success	204
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/lists/{id} [delete]
func (h *Handlers) DeleteList(w http.ResponseWriter, r *http.Request) {
	list, ok := h.ownListOr404(w, r)
	if !ok {
		return
	}
	if err := queries.DeleteList(r.Context(), h.Pool, list.ID); err != nil {
		InternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type addListItemRequest struct {
	ReviewID string `json:"reviewId"`
	// One DJ's set on the night, or omitted for the whole night.
	DjID *string `json:"djId,omitempty"`
	Note *string `json:"note,omitempty"`
}

// AddListItem godoc
//
//	@Summary	Put a night, or one DJ's set on it, on a list of your own (anyone's nights can go on it)
//	@Tags		lists
//	@Accept		json
//	@Param		id		path	string				true	"list id"
//	@Param		body	body	addListItemRequest	true	"the night, the set, and a note"
//	@Success	204
//	@Failure	400	{object}	errorEnvelope
//	@Failure	403	{object}	errorEnvelope
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/lists/{id}/items [post]
func (h *Handlers) AddListItem(w http.ResponseWriter, r *http.Request) {
	list, ok := h.ownListOr404(w, r)
	if !ok {
		return
	}
	var req addListItemRequest
	if err := DecodeJSON(r, &req); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	note := nonEmpty(req.Note)
	if len(deref(note)) > 500 {
		BadRequest(w, "note too long")
		return
	}
	if domain.IsObjectionable(deref(note)) {
		BadRequest(w, domain.ErrObjectionable.Error())
		return
	}
	if !uuidPattern.MatchString(req.ReviewID) {
		NotFound(w)
		return
	}
	review, err := queries.GetReviewByID(r.Context(), h.Pool, req.ReviewID)
	if errors.Is(err, queries.ErrNotFound) {
		NotFound(w)
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	if blocked, err := queries.IsBlockedEitherWay(r.Context(), h.Pool, list.UserID, review.UserID); err != nil {
		InternalError(w, err)
		return
	} else if blocked {
		blockedError(w)
		return
	}
	if req.DjID != nil {
		lineups, err := queries.GetLineupsByReviewIDs(r.Context(), h.Pool, []string{review.ID})
		if err != nil {
			InternalError(w, err)
			return
		}
		if !slices.ContainsFunc(lineups[review.ID], func(e db.LineupEntry) bool { return e.Dj.ID == *req.DjID }) {
			BadRequest(w, "that DJ isn't on the night's lineup")
			return
		}
	}
	if n, err := queries.CountListItems(r.Context(), h.Pool, list.ID); err != nil {
		InternalError(w, err)
		return
	} else if n >= maxListItems {
		BadRequest(w, "that list is full")
		return
	}
	if err := queries.AddListItem(r.Context(), h.Pool, list.ID, review.ID, req.DjID, note); err != nil {
		InternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RemoveListItem godoc
//
//	@Summary	Take a night or set off a list of your own
//	@Tags		lists
//	@Param		id		path	string	true	"list id"
//	@Param		itemId	path	string	true	"item id"
//	@Success	204
//	@Failure	404	{object}	errorEnvelope
//	@Security	BearerAuth
//	@Router		/api/lists/{id}/items/{itemId} [delete]
func (h *Handlers) RemoveListItem(w http.ResponseWriter, r *http.Request) {
	list, ok := h.ownListOr404(w, r)
	if !ok {
		return
	}
	itemID := chi.URLParam(r, "itemId")
	if !uuidPattern.MatchString(itemID) {
		NotFound(w)
		return
	}
	removed, err := queries.RemoveListItem(r.Context(), h.Pool, list.ID, itemID)
	if err != nil {
		InternalError(w, err)
		return
	}
	if !removed {
		NotFound(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// listOr404 loads the list in the path, writing a 404 if there isn't one.
func (h *Handlers) listOr404(w http.ResponseWriter, r *http.Request) (*queries.List, bool) {
	id := chi.URLParam(r, "id")
	if !uuidPattern.MatchString(id) {
		NotFound(w)
		return nil, false
	}
	list, err := queries.GetList(r.Context(), h.Pool, id)
	return fetchOr404(w, list, err)
}

// ownListOr404 is listOr404 for a list the caller made; anyone else's 404s.
func (h *Handlers) ownListOr404(w http.ResponseWriter, r *http.Request) (*queries.List, bool) {
	user, ok := mustUser(w, r)
	if !ok {
		return nil, false
	}
	list, ok := h.listOr404(w, r)
	if !ok {
		return nil, false
	}
	if list.UserID != user.ID {
		NotFound(w)
		return nil, false
	}
	return list, true
}

func mapItems(items []queries.ListItem, f func(queries.ListItem) string) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i] = f(item)
	}
	return out
}
