package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// List is someone's curated list of nights and sets.
type List struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Title       string    `json:"title"`
	Description *string   `json:"description" extensions:"x-nullable"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

const listCols = "id, user_id, title, description, created_at, updated_at"

func scanList(row pgx.Row) (*List, error) {
	var l List
	err := row.Scan(&l.ID, &l.UserID, &l.Title, &l.Description, &l.CreatedAt, &l.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func CreateList(ctx context.Context, q DBTX, userID, title string, description *string) (*List, error) {
	return scanList(q.QueryRow(ctx, `
		INSERT INTO lists (user_id, title, description) VALUES ($1, $2, $3)
		RETURNING `+listCols, userID, title, description))
}

func GetList(ctx context.Context, q DBTX, id string) (*List, error) {
	return scanList(q.QueryRow(ctx, "SELECT "+listCols+" FROM lists WHERE id = $1", id))
}

func UpdateList(ctx context.Context, q DBTX, id, title string, description *string) (*List, error) {
	return scanList(q.QueryRow(ctx, `
		UPDATE lists SET title = $2, description = $3, updated_at = now() WHERE id = $1
		RETURNING `+listCols, id, title, description))
}

func DeleteList(ctx context.Context, q DBTX, id string) error {
	_, err := q.Exec(ctx, "DELETE FROM lists WHERE id = $1", id)
	return err
}

func CountListsByUser(ctx context.Context, q DBTX, userID string) (int, error) {
	var n int
	err := q.QueryRow(ctx, "SELECT COUNT(*) FROM lists WHERE user_id = $1", userID).Scan(&n)
	return n, err
}

// ListSummary is a list as a profile shows it: how many items it has, and
// (when reviewID is given to ListsByUser) whether that night is on it.
type ListSummary struct {
	List
	ItemCount int64 `json:"itemCount"`
	HasReview bool  `json:"hasReview"`
	// CoverImages are photos of the DJs on its first few items, for its tile.
	CoverImages []string `json:"coverImages"`
}

// ListsByUser returns userID's lists, most recently changed first.
// HasReview says whether reviewID (if any) is on each, as a night or a set.
func ListsByUser(ctx context.Context, q DBTX, userID string, reviewID *string) ([]ListSummary, error) {
	rows, err := q.Query(ctx, `
		SELECT l.id, l.user_id, l.title, l.description, l.created_at, l.updated_at,
			(SELECT COUNT(*) FROM list_items i WHERE i.list_id = l.id),
			EXISTS (SELECT 1 FROM list_items i WHERE i.list_id = l.id AND i.review_id = $2),
			coalesce(ARRAY(
				SELECT d.image_url
				FROM list_items i
				JOIN review_lineup rl ON rl.review_id = i.review_id AND (i.dj_id IS NULL OR rl.dj_id = i.dj_id)
				JOIN djs d ON d.id = rl.dj_id
				WHERE i.list_id = l.id AND d.image_url IS NOT NULL
				GROUP BY d.image_url
				ORDER BY MIN(i.position)
				LIMIT 4
			), '{}')
		FROM lists l
		WHERE l.user_id = $1
		ORDER BY l.updated_at DESC`, userID, reviewID)
	return collect(rows, err, func(row pgx.CollectableRow) (ListSummary, error) {
		var s ListSummary
		err := row.Scan(&s.ID, &s.UserID, &s.Title, &s.Description, &s.CreatedAt, &s.UpdatedAt, &s.ItemCount, &s.HasReview, &s.CoverImages)
		return s, err
	})
}

// ListItem is a night, or one DJ's set on it (DjID), on a list.
type ListItem struct {
	ID       string  `json:"id"`
	ReviewID string  `json:"reviewId"`
	DjID     *string `json:"djId" extensions:"x-nullable"`
	Note     *string `json:"note" extensions:"x-nullable"`
}

// GetListItems returns a list's items in order.
func GetListItems(ctx context.Context, q DBTX, listID string) ([]ListItem, error) {
	rows, err := q.Query(ctx, `
		SELECT id, review_id, dj_id, note FROM list_items WHERE list_id = $1 ORDER BY position, created_at`, listID)
	return collect(rows, err, pgx.RowToStructByPos[ListItem])
}

func CountListItems(ctx context.Context, q DBTX, listID string) (int, error) {
	var n int
	err := q.QueryRow(ctx, "SELECT COUNT(*) FROM list_items WHERE list_id = $1", listID).Scan(&n)
	return n, err
}

// AddListItem puts a night (or a set) at the end of a list and touches the
// list; adding one that's already on it does nothing.
func AddListItem(ctx context.Context, q DBTX, listID, reviewID string, djID, note *string) error {
	if _, err := q.Exec(ctx, `
		INSERT INTO list_items (list_id, review_id, dj_id, note, position)
		SELECT $1, $2, $3, $4, coalesce(MAX(position), 0) + 1 FROM list_items WHERE list_id = $1
		ON CONFLICT DO NOTHING`, listID, reviewID, djID, note); err != nil {
		return err
	}
	_, err := q.Exec(ctx, "UPDATE lists SET updated_at = now() WHERE id = $1", listID)
	return err
}

// RemoveListItem takes an item off listID, reporting whether it was on it.
func RemoveListItem(ctx context.Context, q DBTX, listID, itemID string) (bool, error) {
	tag, err := q.Exec(ctx, "DELETE FROM list_items WHERE id = $1 AND list_id = $2", itemID, listID)
	if err != nil || tag.RowsAffected() == 0 {
		return false, err
	}
	_, err = q.Exec(ctx, "UPDATE lists SET updated_at = now() WHERE id = $1", listID)
	return true, err
}
