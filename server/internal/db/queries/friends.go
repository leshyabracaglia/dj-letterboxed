package queries

import (
	"context"
	"time"

	"beatboxd/server/internal/db"
)

// Friends, here, are mutual follows: two people who each follow the other.

// mutualFollowCond is true when users a and b follow each other.
func mutualFollowCond(a, b string) string {
	return `EXISTS (SELECT 1 FROM follows f1 WHERE f1.follower_id = ` + a + ` AND f1.following_id = ` + b + `)
		AND EXISTS (SELECT 1 FROM follows f2 WHERE f2.follower_id = ` + b + ` AND f2.following_id = ` + a + `)`
}

// FriendsCheckedInAt returns userID's friends who checked in at venueID
// since `since` (the same night).
func FriendsCheckedInAt(ctx context.Context, q DBTX, userID, venueID string, since time.Time) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedUserCols+`
		FROM users u
		WHERE u.id <> $1 AND `+mutualFollowCond("$1::uuid", "u.id")+`
			AND EXISTS (SELECT 1 FROM check_ins c WHERE c.user_id = u.id AND c.venue_id = $2 AND c.created_at >= $3)
		ORDER BY u.username`, userID, venueID, since)
	return collect(rows, err, rowsOf(scanUser))
}
