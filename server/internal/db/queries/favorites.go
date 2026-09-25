package queries

import (
	"context"

	"beatboxd/server/internal/db"
)

// SetFavoriteReviews replaces the caller's showcased favorite reviews with
// reviewIDs, in order (index 0 = position 1, the top favorite). Callers
// must ensure every id in reviewIDs is owned by userID and that the slice
// has no duplicates before calling - this function trusts its input the
// same way SetReviewTags does.
func SetFavoriteReviews(ctx context.Context, q DBTX, userID string, reviewIDs []string) error {
	if _, err := q.Exec(ctx, "DELETE FROM favorite_reviews WHERE user_id = $1", userID); err != nil {
		return err
	}
	for i, reviewID := range reviewIDs {
		if _, err := q.Exec(ctx,
			"INSERT INTO favorite_reviews (user_id, review_id, position) VALUES ($1, $2, $3)",
			userID, reviewID, i+1); err != nil {
			return err
		}
	}
	return nil
}

// qualifiedReviewCols is reviewCols with every column qualified against the
// "r" alias - required whenever reviews is joined against another table
// that shares column names (favorite_reviews has its own user_id and
// created_at), same reasoning as qualifiedUserCols in follows.go.
const qualifiedReviewCols = "r.id, r.user_id, r.dj_id, r.event_id, r.rating, r.review_text, r.crowd_vibe, r.crowd_vibe_note, r.seen_at, r.created_at, r.updated_at"

// GetFavoriteReviews returns a user's showcased favorite reviews ordered by
// position (their #1 favorite first).
func GetFavoriteReviews(ctx context.Context, q DBTX, userID string) ([]db.Review, error) {
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedReviewCols+` FROM reviews r
		JOIN favorite_reviews f ON f.review_id = r.id
		WHERE f.user_id = $1
		ORDER BY f.position ASC`, userID)
	return collectReviews(rows, err)
}
