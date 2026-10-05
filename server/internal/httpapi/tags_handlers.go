package httpapi

import (
	"net/http"

	"beatboxd/server/internal/db/queries"
)

// ListTags godoc
//
//	@Summary	List the tag library (defaults plus every tag users have added), most used first
//	@Tags		tags
//	@Produce	json
//	@Param		q		query	string	false	"filter to tags containing this text"
//	@Param		limit	query	int		false	"max results, 1-50, default 30"
//	@Success	200		{array}	queries.TagSummary
//	@Router		/api/tags [get]
func (h *Handlers) ListTags(w http.ResponseWriter, r *http.Request) {
	tags, err := queries.SearchTags(r.Context(), h.Pool, r.URL.Query().Get("q"), queryLimit(r, 30, 50))
	if err != nil {
		InternalError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, orEmpty(tags))
}
