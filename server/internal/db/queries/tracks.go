package queries

import (
	"cmp"
	"context"
	"errors"
	"slices"

	"github.com/jackc/pgx/v5"

	"beatboxd/server/internal/db"
)

// TrackInput is a track to put on a review; see db.ReviewTrack.
type TrackInput struct {
	DjID       *string
	Source     string
	ExternalID *string
	URL        *string
	Title      *string
	Artist     *string
	ArtworkURL *string
	Note       *string
}

// AddReviewTracks saves a review's tracks in the order given.
func AddReviewTracks(ctx context.Context, q DBTX, reviewID string, tracks []TrackInput) error {
	if len(tracks) == 0 {
		return nil
	}
	n := len(tracks)
	djIDs, externalIDs, urls, titles, artists, artworks, notes := make([]*string, n), make([]*string, n), make([]*string, n), make([]*string, n), make([]*string, n), make([]*string, n), make([]*string, n)
	positions, sources := make([]int16, n), make([]string, n)
	for i, t := range tracks {
		djIDs[i], positions[i], sources[i] = t.DjID, int16(i), t.Source
		externalIDs[i], urls[i], titles[i], artists[i], artworks[i], notes[i] = t.ExternalID, t.URL, t.Title, t.Artist, t.ArtworkURL, t.Note
	}
	_, err := q.Exec(ctx, `
		INSERT INTO review_tracks (review_id, dj_id, position, source, external_id, url, title, artist, artwork_url, note)
		SELECT $1, * FROM unnest($2::uuid[], $3::smallint[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[])`,
		reviewID, djIDs, positions, sources, externalIDs, urls, titles, artists, artworks, notes)
	return err
}

const reviewTrackCols = `t.id, t.review_id, t.dj_id, t.source, t.external_id, t.url, t.title, t.artist, t.artwork_url, t.note, t.identified_by_user_id`

func scanReviewTrack(row pgx.Row, t *db.ReviewTrack, extra ...any) error {
	return row.Scan(append([]any{&t.ID, &t.ReviewID, &t.DjID, &t.Source, &t.ExternalID, &t.URL, &t.Title, &t.Artist, &t.ArtworkURL, &t.Note, &t.IdentifiedByUserID}, extra...)...)
}

// GetTracksByReviewIDs returns each given review's tracks in the order they
// were put on it, keyed by review id.
func GetTracksByReviewIDs(ctx context.Context, q DBTX, reviewIDs []string) (map[string][]db.ReviewTrack, error) {
	if len(reviewIDs) == 0 {
		return map[string][]db.ReviewTrack{}, nil
	}
	rows, err := q.Query(ctx, `
		SELECT `+reviewTrackCols+`
		FROM review_tracks t
		WHERE t.review_id = ANY($1)
		ORDER BY t.review_id, t.position`, reviewIDs)
	return collectGrouped(rows, err, func(row pgx.CollectableRow) (keyed[db.ReviewTrack], error) {
		var k keyed[db.ReviewTrack]
		err := scanReviewTrack(row, &k.Value)
		k.Key = k.Value.ReviewID
		return k, err
	})
}

// TopTrack is a track people highlighted from a DJ's sets: how many nights
// it was picked on, and the latest pick's details and note.
type TopTrack struct {
	Track db.ReviewTrack `json:"track"`
	Picks int64          `json:"picks"`
}

// GetDjTopTracks returns the identified tracks people highlighted from
// djID's sets, most picked first. The same track picked from different
// services counts once (by title and artist). Picks by excludeUserIDs (who's
// hidden from the caller) are left out.
func GetDjTopTracks(ctx context.Context, q DBTX, djID string, excludeUserIDs []string, limit int) ([]TopTrack, error) {
	if excludeUserIDs == nil {
		// nil goes to Postgres as NULL, and nothing is NOT = ANY(NULL).
		excludeUserIDs = []string{}
	}
	rows, err := q.Query(ctx, `
		SELECT DISTINCT ON (lower(t.title), lower(coalesce(t.artist, ''))) `+reviewTrackCols+`,
			COUNT(*) OVER (PARTITION BY lower(t.title), lower(coalesce(t.artist, ''))) AS picks
		FROM review_tracks t
		JOIN reviews r ON r.id = t.review_id
		WHERE t.dj_id = $1 AND t.title IS NOT NULL AND NOT (r.user_id = ANY($2))
		ORDER BY lower(t.title), lower(coalesce(t.artist, '')), (t.note IS NULL), t.created_at DESC`,
		djID, excludeUserIDs)
	if err != nil {
		return nil, err
	}
	tracks, err := collect(rows, nil, func(row pgx.CollectableRow) (TopTrack, error) {
		var top TopTrack
		err := scanReviewTrack(row, &top.Track, &top.Picks)
		return top, err
	})
	if err != nil {
		return nil, err
	}
	slices.SortStableFunc(tracks, func(a, b TopTrack) int { return cmp.Compare(b.Picks, a.Picks) })
	if len(tracks) > limit {
		tracks = tracks[:limit]
	}
	return tracks, nil
}

// GetTrack returns one track on a review, with the review's owner.
func GetTrack(ctx context.Context, q DBTX, trackID string) (*db.ReviewTrack, string, error) {
	var t db.ReviewTrack
	var ownerID string
	err := scanReviewTrack(q.QueryRow(ctx, `
		SELECT `+reviewTrackCols+`, r.user_id
		FROM review_tracks t JOIN reviews r ON r.id = t.review_id
		WHERE t.id = $1`, trackID), &t, &ownerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", ErrNotFound
	}
	return &t, ownerID, err
}

// TrackSuggestionInput is what someone thinks an unidentified track is.
type TrackSuggestionInput struct {
	Source     string
	ExternalID *string
	URL        *string
	Title      string
	Artist     *string
	ArtworkURL *string
}

// CreateTrackSuggestion records userID's suggestion for trackID and returns
// its id; a repeat of one they already made returns that one's.
func CreateTrackSuggestion(ctx context.Context, q DBTX, trackID, userID string, in TrackSuggestionInput) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO track_suggestions (track_id, user_id, source, external_id, url, title, artist, artwork_url)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT DO NOTHING
			RETURNING id
		)
		SELECT id FROM inserted
		UNION ALL
		SELECT id FROM track_suggestions
		WHERE track_id = $1 AND user_id = $2 AND lower(title) = lower($6) AND lower(coalesce(artist, '')) = lower(coalesce($7, ''))
		LIMIT 1`,
		trackID, userID, in.Source, in.ExternalID, in.URL, in.Title, in.Artist, in.ArtworkURL).Scan(&id)
	return id, err
}

// TrackSuggestionRef is a suggestion with who it's from, its track, and
// that track's review and owner, for deciding who may act on it.
type TrackSuggestionRef struct {
	ID, TrackID, UserID, ReviewID, OwnerID string
}

func GetTrackSuggestionRef(ctx context.Context, q DBTX, id string) (*TrackSuggestionRef, error) {
	var s TrackSuggestionRef
	err := q.QueryRow(ctx, `
		SELECT s.id, s.track_id, s.user_id, t.review_id, r.user_id
		FROM track_suggestions s
		JOIN review_tracks t ON t.id = s.track_id
		JOIN reviews r ON r.id = t.review_id
		WHERE s.id = $1`, id).Scan(&s.ID, &s.TrackID, &s.UserID, &s.ReviewID, &s.OwnerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &s, err
}

// AcceptTrackSuggestion fills in the suggestion's track with it, credits
// whoever made it, and clears the track's suggestions (it's identified now).
func AcceptTrackSuggestion(ctx context.Context, q DBTX, id string) error {
	if _, err := q.Exec(ctx, `
		UPDATE review_tracks t
		SET source = s.source, external_id = s.external_id, url = s.url, title = s.title,
			artist = s.artist, artwork_url = s.artwork_url, identified_by_user_id = s.user_id
		FROM track_suggestions s
		WHERE s.id = $1 AND t.id = s.track_id`, id); err != nil {
		return err
	}
	_, err := q.Exec(ctx, `
		DELETE FROM track_suggestions
		WHERE track_id = (SELECT track_id FROM track_suggestions WHERE id = $1)`, id)
	return err
}

func DeleteTrackSuggestion(ctx context.Context, q DBTX, id string) error {
	_, err := q.Exec(ctx, "DELETE FROM track_suggestions WHERE id = $1", id)
	return err
}

// GetSuggestionsByTrackIDs returns each given track's suggestions, oldest
// first, keyed by track id, leaving out those by excludeUserIDs.
func GetSuggestionsByTrackIDs(ctx context.Context, q DBTX, trackIDs, excludeUserIDs []string) (map[string][]db.TrackSuggestion, error) {
	if len(trackIDs) == 0 {
		return map[string][]db.TrackSuggestion{}, nil
	}
	if excludeUserIDs == nil {
		excludeUserIDs = []string{}
	}
	rows, err := q.Query(ctx, `
		SELECT s.id, s.track_id, s.source, s.external_id, s.url, s.title, s.artist, s.artwork_url, s.created_at, `+qualifiedUserCols+`
		FROM track_suggestions s
		JOIN users u ON u.id = s.user_id
		WHERE s.track_id = ANY($1) AND NOT (s.user_id = ANY($2))
		ORDER BY s.track_id, s.created_at`, trackIDs, excludeUserIDs)
	return collectGrouped(rows, err, func(row pgx.CollectableRow) (keyed[db.TrackSuggestion], error) {
		var k keyed[db.TrackSuggestion]
		s := &k.Value
		err := row.Scan(append([]any{&s.ID, &s.TrackID, &s.Source, &s.ExternalID, &s.URL, &s.Title, &s.Artist, &s.ArtworkURL, &s.CreatedAt}, &s.User.ID, &s.User.ClerkID, &s.User.Username, &s.User.DisplayName, &s.User.Bio, &s.User.AvatarURL, &s.User.CreatedAt, &s.User.UpdatedAt)...)
		k.Key = s.TrackID
		return k, err
	})
}
