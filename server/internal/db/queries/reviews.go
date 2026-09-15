package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

const reviewCols = "id, user_id, dj_id, event_id, rating_half_stars, review_text, crowd_vibe, crowd_vibe_note, seen_at, created_at, updated_at"

func scanReview(row pgx.Row) (*db.Review, error) {
	var r db.Review
	err := row.Scan(&r.ID, &r.UserID, &r.DjID, &r.EventID, &r.RatingHalfStars, &r.ReviewText, &r.CrowdVibe, &r.CrowdVibeNote, &r.SeenAt, &r.CreatedAt, &r.UpdatedAt)
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
	err := rows.Scan(&r.ID, &r.UserID, &r.DjID, &r.EventID, &r.RatingHalfStars, &r.ReviewText, &r.CrowdVibe, &r.CrowdVibeNote, &r.SeenAt, &r.CreatedAt, &r.UpdatedAt)
	return r, err
}

type CreateReviewParams struct {
	UserID          string
	DjID            string
	EventID         *string
	RatingHalfStars *int16
	ReviewText      *string
	CrowdVibe       *db.CrowdVibe
	CrowdVibeNote   *string
	SeenAt          time.Time
}

func CreateReview(ctx context.Context, q DBTX, p CreateReviewParams) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, `
		INSERT INTO reviews (user_id, dj_id, event_id, rating_half_stars, review_text, crowd_vibe, crowd_vibe_note, seen_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING `+reviewCols,
		p.UserID, p.DjID, p.EventID, p.RatingHalfStars, p.ReviewText, p.CrowdVibe, p.CrowdVibeNote, p.SeenAt))
}

type UpdateReviewParams struct {
	ID              string
	RatingHalfStars *int16
	ReviewText      *string
	CrowdVibe       *db.CrowdVibe
	CrowdVibeNote   *string
	SeenAt          *time.Time
}

func UpdateReview(ctx context.Context, q DBTX, p UpdateReviewParams) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, `
		UPDATE reviews SET
			rating_half_stars = COALESCE($2, rating_half_stars),
			review_text = COALESCE($3, review_text),
			crowd_vibe = COALESCE($4, crowd_vibe),
			crowd_vibe_note = COALESCE($5, crowd_vibe_note),
			seen_at = COALESCE($6, seen_at),
			updated_at = now()
		WHERE id = $1
		RETURNING `+reviewCols,
		p.ID, p.RatingHalfStars, p.ReviewText, p.CrowdVibe, p.CrowdVibeNote, p.SeenAt))
}

func GetReviewByID(ctx context.Context, q DBTX, id string) (*db.Review, error) {
	return scanReview(q.QueryRow(ctx, "SELECT "+reviewCols+" FROM reviews WHERE id = $1", id))
}

func DeleteReview(ctx context.Context, q DBTX, id string) error {
	_, err := q.Exec(ctx, "DELETE FROM reviews WHERE id = $1", id)
	return err
}

// ListReviewsByUser returns reviews for userID ordered seen_at desc,
// optionally paginated by a seen_at cursor (strictly less than).
func ListReviewsByUser(ctx context.Context, q DBTX, userID string, cursor *time.Time, limit int) ([]db.Review, error) {
	var rows pgx.Rows
	var err error
	if cursor != nil {
		rows, err = q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE user_id = $1 AND seen_at < $2 ORDER BY seen_at DESC LIMIT $3", userID, *cursor, limit)
	} else {
		rows, err = q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE user_id = $1 ORDER BY seen_at DESC LIMIT $2", userID, limit)
	}
	return collectReviews(rows, err)
}

// ListReviewsByEvent returns all reviews for an event, ordered seen_at desc
// (events.getById has no pagination in the ported tRPC procedure).
func ListReviewsByEvent(ctx context.Context, q DBTX, eventID string) ([]db.Review, error) {
	rows, err := q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE event_id = $1 ORDER BY seen_at DESC", eventID)
	return collectReviews(rows, err)
}

func ListReviewsByDj(ctx context.Context, q DBTX, djID string, cursor *time.Time, limit int) ([]db.Review, error) {
	var rows pgx.Rows
	var err error
	if cursor != nil {
		rows, err = q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE dj_id = $1 AND seen_at < $2 ORDER BY seen_at DESC LIMIT $3", djID, *cursor, limit)
	} else {
		rows, err = q.Query(ctx, "SELECT "+reviewCols+" FROM reviews WHERE dj_id = $1 ORDER BY seen_at DESC LIMIT $2", djID, limit)
	}
	return collectReviews(rows, err)
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

func LikeReview(ctx context.Context, q DBTX, reviewID, userID string) error {
	_, err := q.Exec(ctx, "INSERT INTO review_likes (review_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", reviewID, userID)
	return err
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

	deduped := dedupeStrings(taggedUserIDs)
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

func dedupeStrings(in []string) []string {
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
