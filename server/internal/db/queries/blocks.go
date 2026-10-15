package queries

import (
	"context"

	"beatboxd/server/internal/db"
)

// Block blocks blockedID for blockerID and drops any follows between them,
// either way.
func Block(ctx context.Context, q DBTX, blockerID, blockedID string) error {
	_, err := q.Exec(ctx, `
		WITH unfollow AS (
			DELETE FROM follows
			WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)
		)
		INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, blockerID, blockedID)
	return err
}

func Unblock(ctx context.Context, q DBTX, blockerID, blockedID string) error {
	_, err := q.Exec(ctx, "DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2", blockerID, blockedID)
	return err
}

// ListBlockedUsers returns the users userID has blocked, most recent first.
func ListBlockedUsers(ctx context.Context, q DBTX, userID string) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedUserCols+` FROM blocks b
		JOIN users u ON u.id = b.blocked_id
		WHERE b.blocker_id = $1
		ORDER BY b.created_at DESC`, userID)
	return scanUserRows(rows, err)
}

// HiddenUserIDs returns the users hidden from userID: everyone they blocked
// and everyone who blocked them.
func HiddenUserIDs(ctx context.Context, q DBTX, userID string) (map[string]bool, error) {
	rows, err := q.Query(ctx, `
		SELECT blocked_id FROM blocks WHERE blocker_id = $1
		UNION
		SELECT blocker_id FROM blocks WHERE blocked_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// IsBlockedEitherWay reports whether either user has blocked the other.
func IsBlockedEitherWay(ctx context.Context, q DBTX, a, b string) (bool, error) {
	var blocked bool
	err := q.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM blocks
			WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
		)`, a, b).Scan(&blocked)
	return blocked, err
}

type CreateReportParams struct {
	ReporterID     string
	ReportedUserID string
	ReviewID       *string
	CommentID      *string
	Reason         string
	Content        *string
}

func CreateReport(ctx context.Context, q DBTX, p CreateReportParams) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		INSERT INTO reports (reporter_id, reported_user_id, review_id, comment_id, reason, content)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`, p.ReporterID, p.ReportedUserID, p.ReviewID, p.CommentID, p.Reason, p.Content).Scan(&id)
	return id, err
}
