package queries

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type Engagement struct {
	LikeCount    int64 `json:"likeCount"`
	CommentCount int64 `json:"commentCount"`
	IsLikedByMe  bool  `json:"isLikedByMe"`
}

// AttachEngagement computes like/comment counts (and, when currentUserID is
// non-nil, whether the caller has liked each review) for a set of review
// ids: ad hoc join-and-count, not denormalized columns.
func AttachEngagement(ctx context.Context, q DBTX, reviewIDs []string, currentUserID *string) (map[string]Engagement, error) {
	if len(reviewIDs) == 0 {
		return map[string]Engagement{}, nil
	}

	rows, err := q.Query(ctx, `
		SELECT r.id, COUNT(DISTINCT rl.user_id), COUNT(DISTINCT rc.id)
		FROM reviews r
		LEFT JOIN review_likes rl ON rl.review_id = r.id
		LEFT JOIN review_comments rc ON rc.review_id = r.id
		WHERE r.id = ANY($1)
		GROUP BY r.id`, reviewIDs)
	counts, err := collect(rows, err, func(row pgx.CollectableRow) (keyed[Engagement], error) {
		var k keyed[Engagement]
		err := row.Scan(&k.Key, &k.Value.LikeCount, &k.Value.CommentCount)
		return k, err
	})
	if err != nil {
		return nil, err
	}
	out := make(map[string]Engagement, len(counts))
	for _, c := range counts {
		out[c.Key] = c.Value
	}

	if currentUserID == nil {
		return out, nil
	}

	rows, err = q.Query(ctx, `
		SELECT review_id FROM review_likes
		WHERE review_id = ANY($1) AND user_id = $2`, reviewIDs, *currentUserID)
	liked, err := collect(rows, err, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	for _, id := range liked {
		e := out[id]
		e.IsLikedByMe = true
		out[id] = e
	}
	return out, nil
}
