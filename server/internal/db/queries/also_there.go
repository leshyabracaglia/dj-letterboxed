package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// Friends, here, are mutual follows: two people who each follow the other.

// mutualFollowCond is true when users a and b follow each other.
func mutualFollowCond(a, b string) string {
	return `EXISTS (SELECT 1 FROM follows f1 WHERE f1.follower_id = ` + a + ` AND f1.following_id = ` + b + `)
		AND EXISTS (SELECT 1 FROM follows f2 WHERE f2.follower_id = ` + b + ` AND f2.following_id = ` + a + `)`
}

// sameNightCond is true when reviews r and o are of the same night out: at
// the same venue or event, within a day of each other (see
// sameNightLoggedCond).
const sameNightCond = `abs(extract(epoch FROM o.seen_at - r.seen_at)) < 86400
	AND (o.venue_id = r.venue_id OR o.event_id = r.event_id)`

// GetAlsoThereByReviewIDs returns, for each given review, the friends of its
// poster who logged the same night too, keyed by review id, leaving out
// excludeUserIDs (who's hidden from the caller).
func GetAlsoThereByReviewIDs(ctx context.Context, q DBTX, reviewIDs, excludeUserIDs []string) (map[string][]db.User, error) {
	if len(reviewIDs) == 0 {
		return map[string][]db.User{}, nil
	}
	if excludeUserIDs == nil {
		excludeUserIDs = []string{}
	}
	rows, err := q.Query(ctx, `
		SELECT DISTINCT ON (r.id, u.username) r.id, `+qualifiedUserCols+`
		FROM reviews r
		JOIN reviews o ON o.user_id <> r.user_id AND `+sameNightCond+`
		JOIN users u ON u.id = o.user_id
		WHERE r.id = ANY($1) AND NOT (o.user_id = ANY($2)) AND `+mutualFollowCond("r.user_id", "o.user_id")+`
		ORDER BY r.id, u.username`, reviewIDs, excludeUserIDs)
	return collectGrouped(rows, err, func(row pgx.CollectableRow) (keyed[db.User], error) {
		var k keyed[db.User]
		u := &k.Value
		err := row.Scan(&k.Key, &u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt)
		return k, err
	})
}

// FriendsCheckedInAt returns userID's friends who checked in at venueID
// since `since`.
func FriendsCheckedInAt(ctx context.Context, q DBTX, userID, venueID string, since time.Time) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedUserCols+`
		FROM users u
		WHERE u.id <> $1 AND `+mutualFollowCond("$1::uuid", "u.id")+`
			AND EXISTS (SELECT 1 FROM check_ins c WHERE c.user_id = u.id AND c.venue_id = $2 AND c.created_at >= $3)
		ORDER BY u.username`, userID, venueID, since)
	return collect(rows, err, rowsOf(scanUser))
}
