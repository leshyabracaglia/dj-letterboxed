package queries

import (
	"cmp"
	"context"
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

const reviewTrackCols = `t.id, t.review_id, t.dj_id, t.source, t.external_id, t.url, t.title, t.artist, t.artwork_url, t.note`

func scanReviewTrack(row pgx.Row, t *db.ReviewTrack) error {
	return row.Scan(&t.ID, &t.ReviewID, &t.DjID, &t.Source, &t.ExternalID, &t.URL, &t.Title, &t.Artist, &t.ArtworkURL, &t.Note)
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
		t := &top.Track
		err := row.Scan(&t.ID, &t.ReviewID, &t.DjID, &t.Source, &t.ExternalID, &t.URL, &t.Title, &t.Artist, &t.ArtworkURL, &t.Note, &top.Picks)
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
