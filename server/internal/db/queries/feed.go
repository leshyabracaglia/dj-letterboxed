package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// RankPopularReviewIDs ranks review ids by (like_count + comment_count) desc,
// then created_at desc, optionally excluding a set of ids. Ported from
// feed.ts's fetchPopularReviews ranking step.
func RankPopularReviewIDs(ctx context.Context, q DBTX, limit, offset int, excludeIDs []string) ([]string, error) {
	if limit <= 0 {
		return nil, nil
	}

	rows, err := q.Query(ctx, `
		SELECT r.id
		FROM reviews r
		LEFT JOIN review_likes rl ON rl.review_id = r.id
		LEFT JOIN review_comments rc ON rc.review_id = r.id
		WHERE $1::uuid[] IS NULL OR NOT (r.id = ANY($1))
		GROUP BY r.id
		ORDER BY (COUNT(DISTINCT rl.user_id) + COUNT(DISTINCT rc.id)) DESC, r.created_at DESC
		LIMIT $2 OFFSET $3`, nullableIDs(excludeIDs), limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func nullableIDs(ids []string) any {
	if len(ids) == 0 {
		return nil
	}
	return ids
}

// GetReviewsByIDsOrdered fetches full review rows for the given ids,
// returned in the same order as ids (SQL's ANY() gives no ordering
// guarantee, so re-ordering happens here in Go).
func GetReviewsByIDsOrdered(ctx context.Context, q DBTX, ids []string) ([]db.Review, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	rows, err := q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE id = ANY($1)", ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byID := make(map[string]db.Review, len(ids))
	for rows.Next() {
		r, err := scanReviewRow(rows)
		if err != nil {
			return nil, err
		}
		byID[r.ID] = r
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]db.Review, 0, len(ids))
	for _, id := range ids {
		if r, ok := byID[id]; ok {
			out = append(out, r)
		}
	}
	return out, nil
}

// ListReviewsByUserIDs returns reviews authored by any of userIDs, ordered
// created_at desc, optionally paginated by a created_at cursor. Used by
// feed.getActivity for the followed-users portion of the feed (note: this
// orders/paginates by created_at, unlike listByUser/listByDj which use
// seen_at).
func ListReviewsByUserIDs(ctx context.Context, q DBTX, userIDs []string, cursor *time.Time, limit int) ([]db.Review, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}

	var rows pgx.Rows
	var err error
	if cursor != nil {
		rows, err = q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE user_id = ANY($1) AND created_at < $2 ORDER BY created_at DESC LIMIT $3", userIDs, *cursor, limit)
	} else {
		rows, err = q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE user_id = ANY($1) ORDER BY created_at DESC LIMIT $2", userIDs, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []db.Review
	for rows.Next() {
		r, err := scanReviewRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
