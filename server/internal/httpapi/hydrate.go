package httpapi

import (
	"context"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

type hydrateOpts struct {
	IncludeUser       bool
	IncludeDj         bool
	IncludeEvent      bool
	IncludeEngagement bool
	CurrentUserID     *string
}

func (h *Handlers) hydrateReviews(ctx context.Context, reviews []db.Review, opts hydrateOpts) ([]ReviewDTO, error) {
	dtos := make([]ReviewDTO, len(reviews))
	for i, r := range reviews {
		dtos[i] = newReviewDTO(r)
	}
	if len(reviews) == 0 {
		return dtos, nil
	}

	if opts.IncludeUser {
		ids := uniqueStrings(mapField(reviews, func(r db.Review) string { return r.UserID }))
		users, err := queries.GetUsersByIDs(ctx, h.Pool, ids)
		if err != nil {
			return nil, err
		}
		for i, r := range reviews {
			if u, ok := users[r.UserID]; ok {
				uu := u
				dtos[i].User = &uu
			}
		}
	}

	if opts.IncludeDj {
		ids := uniqueStrings(mapField(reviews, func(r db.Review) string { return r.DjID }))
		djs, err := queries.GetDjsByIDs(ctx, h.Pool, ids)
		if err != nil {
			return nil, err
		}
		for i, r := range reviews {
			if d, ok := djs[r.DjID]; ok {
				dd := d
				dtos[i].Dj = &dd
			}
		}
	}

	if opts.IncludeEvent {
		var ids []string
		for _, r := range reviews {
			if r.EventID != nil {
				ids = append(ids, *r.EventID)
			}
		}
		events, err := queries.GetEventsByIDs(ctx, h.Pool, uniqueStrings(ids))
		if err != nil {
			return nil, err
		}
		for i, r := range reviews {
			if r.EventID == nil {
				continue
			}
			if e, ok := events[*r.EventID]; ok {
				ee := e
				dtos[i].Event = &ee
			}
		}
	}

	if opts.IncludeEngagement {
		ids := mapField(reviews, func(r db.Review) string { return r.ID })
		eng, err := queries.AttachEngagement(ctx, h.Pool, ids, opts.CurrentUserID)
		if err != nil {
			return nil, err
		}
		for i, r := range reviews {
			if e, ok := eng[r.ID]; ok {
				dtos[i] = dtos[i].withEngagement(e)
			}
		}
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

func uniqueStrings(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
