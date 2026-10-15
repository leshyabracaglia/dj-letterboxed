package queries

import (
	"context"
	"time"
)

// TouchUserActive records that userID is using the app now.
func TouchUserActive(ctx context.Context, q DBTX, userID string) error {
	_, err := q.Exec(ctx, "UPDATE users SET last_active_at = now() WHERE id = $1", userID)
	return err
}

// ReengageCandidate is someone who's been away and has something new in
// their following feed: Count people they follow logged nights since, the
// latest of them by Username/DisplayName (of Subject, the night's title -
// see nightTitleSQL - or "" when it has none).
type ReengageCandidate struct {
	UserID      string
	Username    string
	DisplayName *string
	Subject     string
	Count       int
}

// ListReengageCandidates returns users with a push token who haven't used
// the app in `away` and haven't been nudged within it either, and whom
// someone they follow has logged a night for since both. Nights already
// nudged about don't count again.
func ListReengageCandidates(ctx context.Context, q DBTX, away time.Duration) ([]ReengageCandidate, error) {
	rows, err := q.Query(ctx, `
		WITH due AS (
			SELECT u.id, GREATEST(u.last_active_at, COALESCE(u.reengaged_at, u.last_active_at)) AS since
			FROM users u
			WHERE u.last_active_at < now() - make_interval(secs => $1)
				AND (u.reengaged_at IS NULL OR u.reengaged_at < now() - make_interval(secs => $1))
				AND EXISTS (SELECT 1 FROM push_tokens pt WHERE pt.user_id = u.id)
		), fresh AS (
			SELECT d.id AS user_id, r.user_id AS poster_id, r.created_at, COALESCE(`+nightTitleSQL("r", "e")+`, '') AS subject
			FROM due d
			JOIN follows f ON f.follower_id = d.id
			JOIN reviews r ON r.user_id = f.following_id AND r.created_at > d.since
			LEFT JOIN events e ON e.id = r.event_id
		)
		SELECT DISTINCT ON (fr.user_id) fr.user_id, p.username, p.display_name, fr.subject,
			(SELECT count(DISTINCT x.poster_id) FROM fresh x WHERE x.user_id = fr.user_id)
		FROM fresh fr
		JOIN users p ON p.id = fr.poster_id
		ORDER BY fr.user_id, fr.created_at DESC`, away.Seconds())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ReengageCandidate
	for rows.Next() {
		var c ReengageCandidate
		if err := rows.Scan(&c.UserID, &c.Username, &c.DisplayName, &c.Subject, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ClaimReengage marks userID as nudged now, unless they already were within
// `away` (say, by an overlapping run). Reports whether this call claimed it.
func ClaimReengage(ctx context.Context, q DBTX, userID string, away time.Duration) (bool, error) {
	tag, err := q.Exec(ctx, `
		UPDATE users SET reengaged_at = now()
		WHERE id = $1 AND (reengaged_at IS NULL OR reengaged_at < now() - make_interval(secs => $2))`, userID, away.Seconds())
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
