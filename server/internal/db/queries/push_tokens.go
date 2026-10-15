package queries

import (
	"context"
	"github.com/jackc/pgx/v5"
)

// UpsertPushToken registers a device's token for userID, taking it over
// from whoever had it before (a device signed in to a different account).
func UpsertPushToken(ctx context.Context, q DBTX, userID, token, platform string) error {
	_, err := q.Exec(ctx, `
		INSERT INTO push_tokens (token, user_id, platform) VALUES ($1, $2, $3)
		ON CONFLICT (token) DO UPDATE SET user_id = $2, platform = $3, updated_at = now()`,
		token, userID, platform)
	return err
}

// DeletePushToken removes a token, but only if userID owns it.
func DeletePushToken(ctx context.Context, q DBTX, userID, token string) error {
	_, err := q.Exec(ctx, "DELETE FROM push_tokens WHERE token = $1 AND user_id = $2", token, userID)
	return err
}

// DeletePushTokens drops tokens the push service reported as dead.
func DeletePushTokens(ctx context.Context, q DBTX, tokens []string) error {
	if len(tokens) == 0 {
		return nil
	}
	_, err := q.Exec(ctx, "DELETE FROM push_tokens WHERE token = ANY($1)", tokens)
	return err
}

func ListPushTokens(ctx context.Context, q DBTX, userID string) ([]string, error) {
	rows, err := q.Query(ctx, "SELECT token FROM push_tokens WHERE user_id = $1", userID)
	return collect(rows, err, pgx.RowTo[string])
}

// ReviewNotifyInfo is what a like/comment/tag notification needs about the
// night out: whose it is, and what to call it.
type ReviewNotifyInfo struct {
	OwnerID string
	// Subject is the night's title (see nightTitleSQL); "" when it has none.
	Subject string
}

func GetReviewNotifyInfo(ctx context.Context, q DBTX, reviewID string) (*ReviewNotifyInfo, error) {
	var info ReviewNotifyInfo
	err := q.QueryRow(ctx, `
		SELECT r.user_id, COALESCE(`+nightTitleSQL("r", "e")+`, '')
		FROM reviews r
		LEFT JOIN events e ON e.id = r.event_id
		WHERE r.id = $1`, reviewID).Scan(&info.OwnerID, &info.Subject)
	if err != nil {
		return nil, err
	}
	return &info, nil
}
