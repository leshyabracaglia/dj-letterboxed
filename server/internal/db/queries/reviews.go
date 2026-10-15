package queries

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// A review is one person's night out, and the post; the DJs they saw (each
// optionally rated) are its lineup in review_lineup.

// reviewVerifiedExpr is whether the review's person checked in at its venue
// during its night: from the start of the day logged until 8am the next
// morning, for a night that runs late. seen_at is noon local time on that
// day (the log form sends it so), so that's 12 hours before it to 20 after.
const reviewVerifiedExpr = `EXISTS (
	SELECT 1 FROM check_ins c
	WHERE c.user_id = reviews.user_id AND c.venue_id = reviews.venue_id
		AND c.created_at >= reviews.seen_at - interval '12 hours'
		AND c.created_at < reviews.seen_at + interval '20 hours'
)`

// reviewCols is qualified, so it can be selected FROM reviews joined to
// tables with columns of the same name (favorite_reviews' user_id).
const reviewCols = `reviews.id, reviews.user_id, reviews.event_id, reviews.venue, reviews.venue_id, reviews.city,
	reviews.seen_at, reviews.is_day, reviews.is_night, reviews.rating, reviews.review_text,
	reviews.created_at, reviews.updated_at, ` + reviewVerifiedExpr

func scanReview(row pgx.Row) (*db.Review, error) {
	var r db.Review
	err := row.Scan(&r.ID, &r.UserID, &r.EventID, &r.Venue, &r.VenueID, &r.City,
		&r.SeenAt, &r.IsDay, &r.IsNight, &r.Rating, &r.ReviewText,
		&r.CreatedAt, &r.UpdatedAt, &r.Verified)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &r, nil
}

func collectReviews(rows pgx.Rows, err error) ([]db.Review, error) {
	return collect(rows, err, rowsOf(scanReview))
}

type CreateReviewParams struct {
	UserID  string
	EventID *string
	Venue   *db.Venue
	City    *string
	SeenAt  time.Time
	IsDay   bool
	IsNight bool
	// Rating is required of new nights (the handler enforces it); only
	// seeded stand-ins for nights from before nights were rated leave it nil.
	Rating     *int16
	ReviewText *string
}

// CreateReview stores venue.Name as the review's denormalized venue name.
func CreateReview(ctx context.Context, q DBTX, p CreateReviewParams) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, `
		INSERT INTO reviews (user_id, event_id, venue, venue_id, city, seen_at, is_day, is_night, rating, review_text)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+reviewCols,
		p.UserID, p.EventID, p.Venue.Name, p.Venue.ID, p.City, p.SeenAt, p.IsDay, p.IsNight, p.Rating, p.ReviewText))
}

// LineupInput is a DJ seen on a night, rated or not.
type LineupInput struct {
	DjID       string
	Rating     *int16
	ReviewText *string
}

// AddReviewLineup records the DJs someone saw on their night out and what
// they thought of any they rated.
func AddReviewLineup(ctx context.Context, q DBTX, reviewID string, lineup []LineupInput) error {
	if len(lineup) == 0 {
		return nil
	}
	djIDs := make([]string, len(lineup))
	ratings := make([]*int16, len(lineup))
	texts := make([]*string, len(lineup))
	for i, e := range lineup {
		djIDs[i], ratings[i], texts[i] = e.DjID, e.Rating, e.ReviewText
	}
	_, err := q.Exec(ctx, `
		INSERT INTO review_lineup (review_id, dj_id, rating, review_text)
		SELECT $1, * FROM unnest($2::uuid[], $3::smallint[], $4::text[])`, reviewID, djIDs, ratings, texts)
	return err
}

// GetLineupsByReviewIDs returns each given review's lineup, alphabetically,
// keyed by review id. Reviews with an empty lineup are left out.
func GetLineupsByReviewIDs(ctx context.Context, q DBTX, reviewIDs []string) (map[string][]db.LineupEntry, error) {
	if len(reviewIDs) == 0 {
		return map[string][]db.LineupEntry{}, nil
	}
	rows, err := q.Query(ctx, `
		SELECT rl.review_id, d.id, d.name, d.slug, d.bio, d.genres, d.image_url, d.spotify_id, d.created_by_user_id, d.created_at, d.updated_at,
			rl.rating, rl.review_text
		FROM review_lineup rl
		JOIN djs d ON d.id = rl.dj_id
		WHERE rl.review_id = ANY($1)
		ORDER BY rl.review_id, lower(d.name)`, reviewIDs)
	return collectGrouped(rows, err, func(row pgx.CollectableRow) (keyed[db.LineupEntry], error) {
		var k keyed[db.LineupEntry]
		d := &k.Value.Dj
		err := row.Scan(&k.Key, &d.ID, &d.Name, &d.Slug, &d.Bio, &d.Genres, &d.ImageURL, &d.SpotifyID, &d.CreatedByUserID, &d.CreatedAt, &d.UpdatedAt,
			&k.Value.Rating, &k.Value.ReviewText)
		return k, err
	})
}

func GetReviewByID(ctx context.Context, q DBTX, id string) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, "SELECT "+reviewCols+" FROM reviews WHERE id = $1", id))
}

// GetReviewsByIDsOrdered fetches the given reviews in the same order as ids
// (SQL's ANY() gives no ordering guarantee, so re-ordering happens here).
func GetReviewsByIDsOrdered(ctx context.Context, q DBTX, ids []string) ([]db.Review, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE id = ANY($1)", ids)
	byID, err := collectMap(rows, err, rowsOf(scanReview), func(r db.Review) string { return r.ID })
	if err != nil {
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

// DeleteReview removes a user's night out; its lineup, likes, comments and
// tags go with it via ON DELETE CASCADE. Returns ErrNotFound if there's no
// such review owned by userID.
func DeleteReview(ctx context.Context, q DBTX, id, userID string) error {
	tag, err := q.Exec(ctx, "DELETE FROM reviews WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// listReviewsPage runs a cursor-paginated reviews query: WHERE baseWhere
// (already parameterized against args) AND, if cursor is set, cursorCol <
// the next placeholder - ordered and limited by that same column.
func listReviewsPage(ctx context.Context, q DBTX, baseWhere, cursorCol string, args []any, cursor *time.Time, limit int) ([]db.Review, error) {
	sql := "SELECT " + reviewCols + " FROM reviews WHERE " + baseWhere
	queryArgs := append([]any{}, args...)
	if cursor != nil {
		queryArgs = append(queryArgs, *cursor)
		sql += " AND " + cursorCol + " < $" + strconv.Itoa(len(queryArgs))
	}
	queryArgs = append(queryArgs, limit)
	// created_at breaks ties between nights of the same day (seen_at is a
	// calendar day in practice), newest logged first.
	sql += " ORDER BY " + cursorCol + " DESC, created_at DESC LIMIT $" + strconv.Itoa(len(queryArgs))

	rows, err := q.Query(ctx, sql, queryArgs...)
	return collectReviews(rows, err)
}

// ListReviewsByUser returns userID's nights out ordered seen_at desc,
// optionally paginated by a seen_at cursor (strictly less than).
func ListReviewsByUser(ctx context.Context, q DBTX, userID string, cursor *time.Time, limit int) ([]db.Review, error) {
	return listReviewsPage(ctx, q, "user_id = $1", "seen_at", []any{userID}, cursor, limit)
}

// ListReviewsByDj returns the nights out djID was on the lineup of, rated or
// not, ordered seen_at desc.
func ListReviewsByDj(ctx context.Context, q DBTX, djID string, cursor *time.Time, limit int) ([]db.Review, error) {
	return listReviewsPage(ctx, q, "id IN (SELECT review_id FROM review_lineup WHERE dj_id = $1)", "seen_at", []any{djID}, cursor, limit)
}

// ListReviewsByUserIDs returns nights out by any of userIDs, newest logged
// first (created_at desc), optionally paginated by a created_at cursor. The
// following feed; unlike ListReviewsByUser/ByDj it orders by when a night
// was logged, not the night's date (seen_at).
func ListReviewsByUserIDs(ctx context.Context, q DBTX, userIDs []string, cursor *time.Time, limit int) ([]db.Review, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}
	return listReviewsPage(ctx, q, "user_id = ANY($1)", "created_at", []any{userIDs}, cursor, limit)
}

// ListReviewsByVenue returns the most recent nights at a venue.
func ListReviewsByVenue(ctx context.Context, q DBTX, venueID string, limit int) ([]db.Review, error) {
	return listReviewsPage(ctx, q, "venue_id = $1", "seen_at", []any{venueID}, nil, limit)
}

// ListReviewsByEvent returns the most recent nights out of an event.
func ListReviewsByEvent(ctx context.Context, q DBTX, eventID string, limit int) ([]db.Review, error) {
	return listReviewsPage(ctx, q, "event_id = $1", "seen_at", []any{eventID}, nil, limit)
}

// RankPopularReviewIDs ranks nights out by like_count + comment_count desc,
// then created_at desc.
func RankPopularReviewIDs(ctx context.Context, q DBTX, limit int) ([]string, error) {
	rows, err := q.Query(ctx, `
		SELECT r.id
		FROM reviews r
		LEFT JOIN (SELECT review_id, COUNT(*) AS n FROM review_likes GROUP BY review_id) lk ON lk.review_id = r.id
		LEFT JOIN (SELECT review_id, COUNT(*) AS n FROM review_comments GROUP BY review_id) c ON c.review_id = r.id
		ORDER BY COALESCE(lk.n, 0) + COALESCE(c.n, 0) DESC, r.created_at DESC
		LIMIT $1`, limit)
	return collect(rows, err, pgx.RowTo[string])
}

// LatestReviewCity is the city of the user's most recent night out with
// one, or nil if they haven't logged one.
func LatestReviewCity(ctx context.Context, q DBTX, userID string) (*string, error) {
	var city string
	err := q.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(r.city, ''), v.city) FROM reviews r
		LEFT JOIN venues v ON v.id = r.venue_id
		WHERE r.user_id = $1 AND COALESCE(NULLIF(r.city, ''), v.city) IS NOT NULL
		ORDER BY r.seen_at DESC
		LIMIT 1`, userID).Scan(&city)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &city, nil
}

// nightTitleDjs is how many DJs a night's title names before "+N".
const nightTitleDjs = "3"

// nightTitleSQL is a SQL expression for what the night out reviewAlias is
// called, as lib/review.ts's getNightTitle puts it: the event's name
// (eventAlias, LEFT JOINed on the review's event_id), else the DJs seen in
// lineup order ("Dixon, Âme +2"). Never the venue. NULL when the night has
// neither, so callers can leave the subject out of a message.
func nightTitleSQL(reviewAlias, eventAlias string) string {
	return `COALESCE(` + eventAlias + `.name, (
		SELECT string_agg(t.name, ', ' ORDER BY lower(t.name))
			|| CASE WHEN max(t.total) > ` + nightTitleDjs + ` THEN ' +' || (max(t.total) - ` + nightTitleDjs + `) ELSE '' END
		FROM (
			SELECT d.name, count(*) OVER () AS total
			FROM review_lineup rl JOIN djs d ON d.id = rl.dj_id
			WHERE rl.review_id = ` + reviewAlias + `.id
			ORDER BY lower(d.name)
			LIMIT ` + nightTitleDjs + `
		) t))`
}

// LikeReview reports whether this was a new like (false if already liked).
func LikeReview(ctx context.Context, q DBTX, reviewID, userID string) (bool, error) {
	tag, err := q.Exec(ctx, "INSERT INTO review_likes (review_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", reviewID, userID)
	return tag.RowsAffected() > 0, err
}

func UnlikeReview(ctx context.Context, q DBTX, reviewID, userID string) error {
	_, err := q.Exec(ctx, "DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2", reviewID, userID)
	return err
}

func ListComments(ctx context.Context, q DBTX, reviewID string) ([]db.ReviewComment, error) {
	rows, err := q.Query(ctx, `
		SELECT c.id, c.review_id, c.user_id, c.body, c.created_at, `+qualifiedUserCols+`
		FROM review_comments c
		JOIN users u ON u.id = c.user_id
		WHERE c.review_id = $1
		ORDER BY c.created_at ASC`, reviewID)
	return collect(rows, err, func(row pgx.CollectableRow) (db.ReviewComment, error) {
		var c db.ReviewComment
		var u db.User
		err := row.Scan(&c.ID, &c.ReviewID, &c.UserID, &c.Body, &c.CreatedAt,
			&u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt)
		c.User = &u
		return c, err
	})
}

func AddComment(ctx context.Context, q DBTX, reviewID, userID, body string) (*db.ReviewComment, error) {
	var c db.ReviewComment
	err := q.QueryRow(ctx, `
		INSERT INTO review_comments (review_id, user_id, body)
		VALUES ($1, $2, $3)
		RETURNING id, review_id, user_id, body, created_at`, reviewID, userID, body).
		Scan(&c.ID, &c.ReviewID, &c.UserID, &c.Body, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func GetCommentByID(ctx context.Context, q DBTX, id string) (*db.ReviewComment, error) {
	var c db.ReviewComment
	err := q.QueryRow(ctx, "SELECT id, review_id, user_id, body, created_at FROM review_comments WHERE id = $1", id).
		Scan(&c.ID, &c.ReviewID, &c.UserID, &c.Body, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

func DeleteComment(ctx context.Context, q DBTX, id string) error {
	_, err := q.Exec(ctx, "DELETE FROM review_comments WHERE id = $1", id)
	return err
}

// SetReviewTags replaces who's tagged as being at a night out.
func SetReviewTags(ctx context.Context, q DBTX, reviewID string, taggedUserIDs []string) error {
	if _, err := q.Exec(ctx, "DELETE FROM review_tags WHERE review_id = $1", reviewID); err != nil {
		return err
	}
	deduped := DedupeStrings(taggedUserIDs)
	if len(deduped) == 0 {
		return nil
	}
	_, err := q.Exec(ctx, `
		INSERT INTO review_tags (review_id, tagged_user_id)
		SELECT $1, unnest($2::uuid[])`, reviewID, deduped)
	return err
}

// GetTaggedUsersByReviewIDs returns who's tagged on each given review, keyed
// by review id. Reviews with nobody tagged are left out.
func GetTaggedUsersByReviewIDs(ctx context.Context, q DBTX, reviewIDs []string) (map[string][]db.User, error) {
	if len(reviewIDs) == 0 {
		return map[string][]db.User{}, nil
	}
	rows, err := q.Query(ctx, `
		SELECT t.review_id, `+qualifiedUserCols+` FROM review_tags t
		JOIN users u ON u.id = t.tagged_user_id
		WHERE t.review_id = ANY($1)
		ORDER BY t.review_id, t.created_at`, reviewIDs)
	return collectGrouped(rows, err, func(row pgx.CollectableRow) (keyed[db.User], error) {
		var k keyed[db.User]
		u := &k.Value
		err := row.Scan(&k.Key, &u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt)
		return k, err
	})
}

// DedupeStrings returns in with duplicate values removed, preserving order
// of first occurrence.
func DedupeStrings(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, s := range in {
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
