package queries

import "context"

// TagSummary is a library tag plus how many reviews use it.
type TagSummary struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsDefault bool   `json:"isDefault"`
	UseCount  int64  `json:"useCount"`
}

// SearchTags lists library tags whose name contains query (all tags when
// query is ""), most used first. Unused defaults rank ahead of unused
// user-added tags so a fresh library still suggests something sensible.
func SearchTags(ctx context.Context, q DBTX, query string, limit int) ([]TagSummary, error) {
	rows, err := q.Query(ctx, `
		SELECT t.id, t.name, t.is_default, count(l.review_id) AS use_count
		FROM tags t
		LEFT JOIN review_tag_links l ON l.tag_id = t.id
		WHERE $1 = '' OR t.name ILIKE '%' || $1 || '%'
		GROUP BY t.id
		ORDER BY use_count DESC, t.is_default DESC, t.name
		LIMIT $2`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TagSummary
	for rows.Next() {
		var t TagSummary
		if err := rows.Scan(&t.ID, &t.Name, &t.IsDefault, &t.UseCount); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// SetReviewTagLinks replaces a review's tags with names (already
// normalized - see domain.NormalizeTags), adding any that aren't in the
// library yet as created by userID. Same nil-means-untouched contract as
// SetReviewTags: callers skip this entirely when the field was omitted.
func SetReviewTagLinks(ctx context.Context, q DBTX, reviewID, userID string, names []string) error {
	if _, err := q.Exec(ctx, "DELETE FROM review_tag_links WHERE review_id = $1", reviewID); err != nil {
		return err
	}
	if len(names) == 0 {
		return nil
	}
	if _, err := q.Exec(ctx, `
		INSERT INTO tags (name, created_by_user_id)
		SELECT unnest($1::text[]), $2
		ON CONFLICT (name) DO NOTHING`, names, userID); err != nil {
		return err
	}
	_, err := q.Exec(ctx, `
		INSERT INTO review_tag_links (review_id, tag_id)
		SELECT $1, id FROM tags WHERE name = ANY($2::text[])`, reviewID, names)
	return err
}

// ListTagNamesByReviewIDs returns each review's tag names, alphabetical.
// Reviews with no tags are absent from the map.
func ListTagNamesByReviewIDs(ctx context.Context, q DBTX, reviewIDs []string) (map[string][]string, error) {
	rows, err := q.Query(ctx, `
		SELECT l.review_id, t.name
		FROM review_tag_links l
		JOIN tags t ON t.id = l.tag_id
		WHERE l.review_id = ANY($1::uuid[])
		ORDER BY t.name`, reviewIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string][]string)
	for rows.Next() {
		var reviewID, name string
		if err := rows.Scan(&reviewID, &name); err != nil {
			return nil, err
		}
		out[reviewID] = append(out[reviewID], name)
	}
	return out, rows.Err()
}
