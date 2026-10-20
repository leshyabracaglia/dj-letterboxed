package httpapi

import (
	"context"
	"maps"
	"slices"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

// hydrateReviews turns reviews into what the app shows of each night out:
// who posted it, its event, lineup, tracks, friends also there, tags, tagged friends and engagement
// (with, when currentUserID is set, whether the caller liked it). One query
// per relation, whatever the number of reviews.
func (h *Handlers) hydrateReviews(ctx context.Context, reviews []db.Review, currentUserID *string) ([]ReviewDTO, error) {
	dtos := make([]ReviewDTO, len(reviews))
	if len(reviews) == 0 {
		return dtos, nil
	}
	ids := mapField(reviews, func(r db.Review) string { return r.ID })

	tracks, err := queries.GetTracksByReviewIDs(ctx, h.Pool, ids)
	if err != nil {
		return nil, err
	}
	// Who named identified tracks are hydrated with the posters; unidentified
	// tracks get the suggestions of what they are (not from anyone hidden
	// from the caller).
	userIDs := mapField(reviews, func(r db.Review) string { return r.UserID })
	var unidentified []string
	for _, ts := range tracks {
		for _, t := range ts {
			if t.IdentifiedByUserID != nil {
				userIDs = append(userIDs, *t.IdentifiedByUserID)
			}
			if t.Title == nil {
				unidentified = append(unidentified, t.ID)
			}
		}
	}
	users, err := queries.GetUsersByIDs(ctx, h.Pool, queries.DedupeStrings(userIDs))
	if err != nil {
		return nil, err
	}
	hidden, err := h.hiddenUsers(ctx, currentUserID)
	if err != nil {
		return nil, err
	}
	hiddenIDs := slices.Collect(maps.Keys(hidden))
	suggestions, err := queries.GetSuggestionsByTrackIDs(ctx, h.Pool, unidentified, hiddenIDs)
	if err != nil {
		return nil, err
	}
	alsoThere, err := queries.GetAlsoThereByReviewIDs(ctx, h.Pool, ids, hiddenIDs)
	if err != nil {
		return nil, err
	}
	for _, ts := range tracks {
		for i := range ts {
			t := &ts[i]
			if t.IdentifiedByUserID != nil {
				if u, ok := users[*t.IdentifiedByUserID]; ok {
					t.IdentifiedBy = &u
				}
			}
			if t.Title == nil {
				t.Suggestions = orEmpty(suggestions[t.ID])
			}
		}
	}
	var eventIDs []string
	for _, r := range reviews {
		if r.EventID != nil {
			eventIDs = append(eventIDs, *r.EventID)
		}
	}
	events, err := queries.GetEventsByIDs(ctx, h.Pool, queries.DedupeStrings(eventIDs))
	if err != nil {
		return nil, err
	}
	lineups, err := queries.GetLineupsByReviewIDs(ctx, h.Pool, ids)
	if err != nil {
		return nil, err
	}
	tags, err := queries.ListTagNamesByReviewIDs(ctx, h.Pool, ids)
	if err != nil {
		return nil, err
	}
	tagged, err := queries.GetTaggedUsersByReviewIDs(ctx, h.Pool, ids)
	if err != nil {
		return nil, err
	}
	engagement, err := queries.AttachEngagement(ctx, h.Pool, ids, currentUserID)
	if err != nil {
		return nil, err
	}

	for i, r := range reviews {
		e := engagement[r.ID]
		dto := ReviewDTO{
			Review:       r,
			Lineup:       orEmpty(lineups[r.ID]),
			Tracks:       orEmpty(tracks[r.ID]),
			AlsoThere:    orEmpty(alsoThere[r.ID]),
			TaggedUsers:  orEmpty(tagged[r.ID]),
			Tags:         orEmpty(tags[r.ID]),
			LikeCount:    e.LikeCount,
			CommentCount: e.CommentCount,
			IsLikedByMe:  e.IsLikedByMe,
		}
		if u, ok := users[r.UserID]; ok {
			dto.User = &u
		}
		if r.EventID != nil {
			if ev, ok := events[*r.EventID]; ok {
				dto.Event = &ev
			}
		}
		dtos[i] = dto
	}
	return dtos, nil
}

func mapField(reviews []db.Review, f func(db.Review) string) []string {
	out := make([]string, len(reviews))
	for i, r := range reviews {
		out[i] = f(r)
	}
	return out
}
