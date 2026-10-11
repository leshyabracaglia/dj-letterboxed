package queries

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

const reviewCols = "id, user_id, log_id, dj_id, rating, review_text, seen_at, created_at, updated_at"

func scanReview(row pgx.Row) (*db.Review, error) {
	var r db.Review
	err := row.Scan(&r.ID, &r.UserID, &r.LogID, &r.DjID, &r.Rating, &r.ReviewText, &r.SeenAt, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &r, nil
}

func scanReviewRow(rows pgx.Rows) (db.Review, error) {
	var r db.Review
	err := rows.Scan(&r.ID, &r.UserID, &r.LogID, &r.DjID, &r.Rating, &r.ReviewText, &r.SeenAt, &r.CreatedAt, &r.UpdatedAt)
	return r, err
}

// CreateReview adds a review to a log; it takes the log's user and date.
type CreateReviewParams struct {
	Log        *db.Log
	DjID       *string
	Rating     *int16
	ReviewText *string
}

func CreateReview(ctx context.Context, q DBTX, p CreateReviewParams) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, `
		INSERT INTO reviews (user_id, log_id, dj_id, rating, review_text, seen_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+reviewCols,
		p.Log.UserID, p.Log.ID, p.DjID, p.Rating, p.ReviewText, p.Log.SeenAt))
}

// leadReviewCond is a WHERE condition (alias names the reviews table in the
// query) keeping only each log's lead review: the night review, or without
// one its first DJ review. A night out shows as one post, its lead, which
// carries the rest of the log's reviews and holds its likes and comments.
// Migration 0014 orders reviews the same way - keep the two in step.
func leadReviewCond(alias string) string {
	return alias + `.id = (SELECT lr.id FROM reviews lr WHERE lr.log_id = ` + alias + `.log_id
		ORDER BY lr.dj_id IS NOT NULL, lr.created_at, lr.id LIMIT 1)`
}

// GetLeadReview returns the lead review of a log (see leadReviewCond).
func GetLeadReview(ctx context.Context, q DBTX, logID string) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, "SELECT "+reviewCols+" FROM reviews WHERE log_id = $1 AND "+leadReviewCond("reviews"), logID))
}

// GetLeadReviewIDs returns each given log's lead review id (see
// leadReviewCond, whose order this repeats), keyed by log id.
func GetLeadReviewIDs(ctx context.Context, q DBTX, logIDs []string) (map[string]string, error) {
	out := make(map[string]string, len(logIDs))
	if len(logIDs) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT DISTINCT ON (log_id) log_id, id
		FROM reviews
		WHERE log_id = ANY($1)
		ORDER BY log_id, dj_id IS NOT NULL, created_at, id`, logIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var logID, id string
		if err := rows.Scan(&logID, &id); err != nil {
			return nil, err
		}
		out[logID] = id
	}
	return out, rows.Err()
}

// ListDjReviewsByLogIDs returns the DJ reviews of each given log, by DJ name,
// keyed by log id.
func ListDjReviewsByLogIDs(ctx context.Context, q DBTX, logIDs []string) (map[string][]db.Review, error) {
	out := make(map[string][]db.Review)
	if len(logIDs) == 0 {
		return out, nil
	}
	rows, err := q.Query(ctx, `
		SELECT r.id, r.user_id, r.log_id, r.dj_id, r.rating, r.review_text, r.seen_at, r.created_at, r.updated_at
		FROM reviews r
		JOIN djs d ON d.id = r.dj_id
		WHERE r.log_id = ANY($1)
		ORDER BY lower(d.name)`, logIDs)
	reviews, err := collectReviews(rows, err)
	if err != nil {
		return nil, err
	}
	for _, r := range reviews {
		out[r.LogID] = append(out[r.LogID], r)
	}
	return out, nil
}

func GetReviewByID(ctx context.Context, q DBTX, id string) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, "SELECT "+reviewCols+" FROM reviews WHERE id = $1", id))
}

func DeleteReview(ctx context.Context, q DBTX, id string) error {
	_, err := q.Exec(ctx, "DELETE FROM reviews WHERE id = $1", id)
	return err
}

// listReviewsPage runs a cursor-paginated reviews query: WHERE baseWhere
// (already parameterized against args) AND, if cursor is set, cursorCol <
// the next placeholder - ordered and limited by that same column. Powers
// ListReviewsByUser, ListReviewsByDj, and ListReviewsByUserIDs, which only
// differ in their WHERE clause and cursor column.
func listReviewsPage(ctx context.Context, q DBTX, baseWhere, cursorCol string, args []any, cursor *time.Time, limit int) ([]db.Review, error) {
	sql := "SELECT " + reviewCols + " FROM reviews WHERE " + baseWhere
	queryArgs := append([]any{}, args...)
	if cursor != nil {
		queryArgs = append(queryArgs, *cursor)
		sql += " AND " + cursorCol + " < $" + strconv.Itoa(len(queryArgs))
	}
	queryArgs = append(queryArgs, limit)
	// created_at breaks ties between reviews of the same day (seen_at is a
	// calendar day in practice), newest logged first.
	sql += " ORDER BY " + cursorCol + " DESC, created_at DESC LIMIT $" + strconv.Itoa(len(queryArgs))

	rows, err := q.Query(ctx, sql, queryArgs...)
	return collectReviews(rows, err)
}

// ListReviewsByUser returns userID's nights out (their lead reviews)
// ordered seen_at desc, optionally paginated by a seen_at cursor (strictly
// less than).
func ListReviewsByUser(ctx context.Context, q DBTX, userID string, cursor *time.Time, limit int) ([]db.Review, error) {
	return listReviewsPage(ctx, q, "user_id = $1 AND "+leadReviewCond("reviews"), "seen_at", []any{userID}, cursor, limit)
}

// ListReviewsByVenue returns the most recent nights at a venue (their lead
// reviews).
func ListReviewsByVenue(ctx context.Context, q DBTX, venueID string, limit int) ([]db.Review, error) {
	rows, err := q.Query(ctx, "SELECT "+reviewCols+` FROM reviews
		WHERE log_id IN (SELECT id FROM logs WHERE venue_id = $1) AND `+leadReviewCond("reviews")+`
		ORDER BY seen_at DESC, created_at DESC
		LIMIT $2`, venueID, limit)
	return collectReviews(rows, err)
}

// ListReviewsByDj returns one review per night djID was logged at: the
// reviewer's rating of djID, or - when they only rated the night as a whole -
// the night review of a log with djID on its lineup. Night reviews never
// count toward the DJ's own ratings (see GetDjAggregate).
func ListReviewsByDj(ctx context.Context, q DBTX, djID string, cursor *time.Time, limit int) ([]db.Review, error) {
	return listReviewsPage(ctx, q, `(dj_id = $1 OR (dj_id IS NULL
		AND log_id IN (SELECT log_id FROM log_lineup WHERE dj_id = $1)
		AND NOT EXISTS (SELECT 1 FROM reviews dr WHERE dr.log_id = reviews.log_id AND dr.dj_id = $1)))`,
		"seen_at", []any{djID}, cursor, limit)
}

func collectReviews(rows pgx.Rows, err error) ([]db.Review, error) {
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
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []db.ReviewComment
	for rows.Next() {
		var c db.ReviewComment
		var u db.User
		if err := rows.Scan(&c.ID, &c.ReviewID, &c.UserID, &c.Body, &c.CreatedAt,
			&u.ID, &u.ClerkID, &u.Username, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		c.User = &u
		out = append(out, c)
	}
	return out, rows.Err()
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

// SetReviewTags replaces the tagged-user set for a review. Callers must
// only invoke this when taggedUserIDs is non-nil: nil means "leave tags
// untouched" and is handled by not calling this function at all (see the
// undefined-vs-empty-array contract on the reviews.create/update handlers).
func SetReviewTags(ctx context.Context, q DBTX, reviewID string, taggedUserIDs []string) error {
	if _, err := q.Exec(ctx, "DELETE FROM review_tags WHERE review_id = $1", reviewID); err != nil {
		return err
	}

	deduped := DedupeStrings(taggedUserIDs)
	if len(deduped) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	for _, uid := range deduped {
		batch.Queue("INSERT INTO review_tags (review_id, tagged_user_id) VALUES ($1, $2)", reviewID, uid)
	}
	br := q.SendBatch(ctx, batch)
	defer br.Close()

	for range deduped {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func GetTaggedUsers(ctx context.Context, q DBTX, reviewID string) ([]db.User, error) {
	rows, err := q.Query(ctx, `
		SELECT `+qualifiedUserCols+` FROM review_tags t
		JOIN users u ON u.id = t.tagged_user_id
		WHERE t.review_id = $1`, reviewID)
	return scanUserRows(rows, err)
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
