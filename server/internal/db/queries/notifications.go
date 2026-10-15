package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

type CreateNotificationParams struct {
	UserID    string
	ActorID   string
	Type      string // follow, like, comment or tag
	ReviewID  *string
	CommentID *string
}

// CreateNotification records a notification for p.UserID and reports
// whether it's new: false for one to yourself, one between users who've
// blocked each other, or a repeat follow/like/tag (see the unique indexes in
// 0018_notifications), none of which should push again.
func CreateNotification(ctx context.Context, q DBTX, p CreateNotificationParams) (bool, error) {
	var id string
	err := q.QueryRow(ctx, `
		INSERT INTO notifications (user_id, actor_id, type, review_id, comment_id)
		SELECT $1, $2, $3, $4, $5
		WHERE $1::uuid <> $2::uuid AND NOT EXISTS (
			SELECT 1 FROM blocks
			WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
		)
		ON CONFLICT DO NOTHING
		RETURNING id`, p.UserID, p.ActorID, p.Type, p.ReviewID, p.CommentID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

type Notification struct {
	ID        string    `json:"id"`
	Type      string    `json:"type" enums:"follow,like,comment,tag"`
	CreatedAt time.Time `json:"createdAt"`
	IsUnread  bool      `json:"isUnread"`
	Actor     db.User   `json:"actor"`
	// The night out it's about (not on follows), and its title (see
	// nightTitleSQL).
	ReviewID *string `json:"reviewId"`
	Subject  *string `json:"subject"`
	// The comment's text, on comments.
	CommentBody *string `json:"commentBody"`
	// On tags: whether the recipient has logged the night themselves (see
	// sameNightLoggedCond), so the app only prompts them to if not.
	NightLogged bool `json:"nightLogged"`
}

// sameNightLoggedCond is true when user $1 has a review of their own of the
// night out `theirs` (a reviews alias): at the same venue or event, within a
// day of it (each review's seen_at is midday in its logger's time zone).
const sameNightLoggedCond = `EXISTS (
	SELECT 1 FROM reviews mine
	WHERE mine.user_id = $1 AND mine.id <> theirs.id
		AND abs(extract(epoch FROM mine.seen_at - theirs.seen_at)) < 86400
		AND (mine.venue_id = theirs.venue_id OR mine.event_id = theirs.event_id)
)`

// HasLoggedSameNight reports whether userID has logged the night out
// reviewID themselves (see sameNightLoggedCond).
func HasLoggedSameNight(ctx context.Context, q DBTX, userID, reviewID string) (bool, error) {
	var logged bool
	err := q.QueryRow(ctx, `SELECT `+sameNightLoggedCond+` FROM reviews theirs WHERE theirs.id = $2`, userID, reviewID).Scan(&logged)
	return logged, err
}

// ListNotifications returns userID's notifications created before `before`
// (nil = from the newest), newest first, leaving out anyone blocked either
// way.
func ListNotifications(ctx context.Context, q DBTX, userID string, before *time.Time, limit int) ([]Notification, error) {
	rows, err := q.Query(ctx, `
		SELECT n.id, n.type, n.created_at, n.created_at > me.notifications_seen_at,
			`+qualifiedUserCols+`,
			n.review_id, `+nightTitleSQL("theirs", "e")+`, c.body,
			n.type = 'tag' AND `+sameNightLoggedCond+`
		FROM notifications n
		JOIN users me ON me.id = n.user_id
		JOIN users u ON u.id = n.actor_id
		LEFT JOIN reviews theirs ON theirs.id = n.review_id
		LEFT JOIN events e ON e.id = theirs.event_id
		LEFT JOIN review_comments c ON c.id = n.comment_id
		WHERE n.user_id = $1
			AND ($2::timestamptz IS NULL OR n.created_at < $2)
			AND NOT EXISTS (
				SELECT 1 FROM blocks
				WHERE (blocker_id = $1 AND blocked_id = n.actor_id) OR (blocker_id = n.actor_id AND blocked_id = $1)
			)
		ORDER BY n.created_at DESC
		LIMIT $3`, userID, before, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Notification{}
	for rows.Next() {
		var n Notification
		u := &n.Actor
		if err := rows.Scan(
			&n.ID, &n.Type, &n.CreatedAt, &n.IsUnread,
			&u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt,
			&n.ReviewID, &n.Subject, &n.CommentBody, &n.NightLogged,
		); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// CountUnreadNotifications counts userID's notifications since they last
// opened the list, leaving out anyone blocked either way.
func CountUnreadNotifications(ctx context.Context, q DBTX, userID string) (int, error) {
	var n int
	err := q.QueryRow(ctx, `
		SELECT count(*) FROM notifications n
		JOIN users me ON me.id = n.user_id
		WHERE n.user_id = $1 AND n.created_at > me.notifications_seen_at
			AND NOT EXISTS (
				SELECT 1 FROM blocks
				WHERE (blocker_id = $1 AND blocked_id = n.actor_id) OR (blocker_id = n.actor_id AND blocked_id = $1)
			)`, userID).Scan(&n)
	return n, err
}

// MarkNotificationsSeen marks all of userID's notifications read.
func MarkNotificationsSeen(ctx context.Context, q DBTX, userID string) error {
	_, err := q.Exec(ctx, "UPDATE users SET notifications_seen_at = now() WHERE id = $1", userID)
	return err
}
