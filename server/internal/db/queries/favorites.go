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

// GetFavoriteReviews returns a user's showcased favorite reviews ordered by
// position (their #1 favorite first).
func GetFavoriteReviews(ctx context.Context, q DBTX, userID string) ([]db.Review, error) {
	rows, err := q.Query(ctx, `
		SELECT `+reviewCols+` FROM reviews
		JOIN favorite_reviews f ON f.review_id = reviews.id
		WHERE f.user_id = $1
		ORDER BY f.position ASC`, userID)
	return collectReviews(rows, err)
}
