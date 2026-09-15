package queries

import "context"

type Engagement struct {
	LikeCount    int64 `json:"likeCount"`
	CommentCount int64 `json:"commentCount"`
	IsLikedByMe  bool  `json:"isLikedByMe"`
}

// AttachEngagement computes like/comment counts (and, when currentUserID is
// non-nil, whether the caller has liked each review) for a set of review
// ids. Ported from lib/server/reviewEngagement.ts's attachEngagement: ad hoc
// join-and-count, not denormalized columns.
func AttachEngagement(ctx context.Context, q DBTX, reviewIDs []string, currentUserID *string) (map[string]Engagement, error) {
	out := make(map[string]Engagement, len(reviewIDs))
	if len(reviewIDs) == 0 {
		return out, nil
	}

	rows, err := q.Query(ctx, `
		SELECT r.id, COUNT(DISTINCT rl.user_id), COUNT(DISTINCT rc.id)
		FROM reviews r
		LEFT JOIN review_likes rl ON rl.review_id = r.id
		LEFT JOIN review_comments rc ON rc.review_id = r.id
		WHERE r.id = ANY($1)
		GROUP BY r.id`, reviewIDs)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id string
		var e Engagement
		if err := rows.Scan(&id, &e.LikeCount, &e.CommentCount); err != nil {
			rows.Close()
			return nil, err
		}
		out[id] = e
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if currentUserID == nil {
		return out, nil
	}

	likedRows, err := q.Query(ctx, `
		SELECT review_id FROM review_likes
		WHERE review_id = ANY($1) AND user_id = $2`, reviewIDs, *currentUserID)
	if err != nil {
		return nil, err
	}
	defer likedRows.Close()

	for likedRows.Next() {
		var id string
		if err := likedRows.Scan(&id); err != nil {
			return nil, err
		}
		e := out[id]
		e.IsLikedByMe = true
		out[id] = e
	}
	return out, likedRows.Err()
}
