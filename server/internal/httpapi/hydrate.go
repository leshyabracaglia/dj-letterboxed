package httpapi

import (
	"context"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

type hydrateOpts struct {
	IncludeUser       bool
	IncludeDj         bool
	IncludeLog        bool
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

	// Tags are cheap (one query) and every review display shows them, so
	// they're always attached rather than opt-in.
	tags, err := queries.ListTagNamesByReviewIDs(ctx, h.Pool, mapField(reviews, func(r db.Review) string { return r.ID }))
	if err != nil {
		return nil, err
	}
	for i, r := range reviews {
		if t, ok := tags[r.ID]; ok {
			dtos[i].Tags = t
		}
	}

	if opts.IncludeUser {
		ids := queries.DedupeStrings(mapField(reviews, func(r db.Review) string { return r.UserID }))
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
		// Night reviews have no DJ.
		var ids []string
		for _, r := range reviews {
			if r.DjID != nil {
				ids = append(ids, *r.DjID)
			}
		}
		djs, err := queries.GetDjsByIDs(ctx, h.Pool, queries.DedupeStrings(ids))
		if err != nil {
			return nil, err
		}
		for i, r := range reviews {
			if r.DjID == nil {
				continue
			}
			if d, ok := djs[*r.DjID]; ok {
				dd := d
				dtos[i].Dj = &dd
			}
		}
	}

	if opts.IncludeLog {
		logs, err := queries.GetLogsByIDs(ctx, h.Pool, queries.DedupeStrings(mapField(reviews, func(r db.Review) string { return r.LogID })))
		if err != nil {
			return nil, err
		}
		var eventIDs, logIDs []string
		for id, l := range logs {
			logIDs = append(logIDs, id)
			if l.EventID != nil {
				eventIDs = append(eventIDs, *l.EventID)
			}
		}
		events, err := queries.GetEventsByIDs(ctx, h.Pool, queries.DedupeStrings(eventIDs))
		if err != nil {
			return nil, err
		}
		lineups, err := queries.GetLineupsByLogIDs(ctx, h.Pool, logIDs)
		if err != nil {
			return nil, err
		}
		for i, r := range reviews {
			l, ok := logs[r.LogID]
			if !ok {
				continue
			}
			dto := LogDTO{Log: l, Lineup: lineups[l.ID]}
			if dto.Lineup == nil {
				dto.Lineup = []db.Dj{}
			}
			if l.EventID != nil {
				if e, ok := events[*l.EventID]; ok {
					ee := e
					dto.Event = &ee
				}
			}
			dtos[i].Log = &dto
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
