// Command seed inserts fixed dev fixture data, ported from lib/db/seed.ts.
// Purely additive (no truncation beforehand) — matches the original script.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "seed:", err)
		os.Exit(1)
	}
	fmt.Println("Seed complete.")
}

func run() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("missing DATABASE_URL")
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	fmt.Println("Seeding dev data...")

	alice, err := queries.CreateUser(ctx, pool, "seed_alice", "alice", strPtr("Alice"), strPtr("Techno head, always front row."))
	if err != nil {
		return err
	}
	bob, err := queries.CreateUser(ctx, pool, "seed_bob", "bob", strPtr("Bob"), strPtr("House music, warehouse parties."))
	if err != nil {
		return err
	}

	dj1, err := queries.CreateDj(ctx, pool, "Nova Reyes", "nova-reyes", strPtr("Melodic techno producer and DJ."), []string{"techno", "melodic techno"}, nil, nil, alice.ID)
	if err != nil {
		return err
	}
	dj2, err := queries.CreateDj(ctx, pool, "Deep Current", "deep-current", strPtr("Deep house selector."), []string{"house", "deep house"}, nil, nil, bob.ID)
	if err != nil {
		return err
	}
	dj3, err := queries.CreateDj(ctx, pool, "Static Bloom", "static-bloom", strPtr("Breaks and bass, no filler."), []string{"breaks", "bass"}, nil, nil, alice.ID)
	if err != nil {
		return err
	}

	eventDate := mustParse("2026-06-14T23:00:00Z")
	event1, err := queries.CreateEvent(ctx, pool, "Midnight Frequencies", "The Foundry", strPtr("Brooklyn, NY"), eventDate, nil, alice.ID)
	if err != nil {
		return err
	}

	electric := db.CrowdVibeElectric
	good := db.CrowdVibeGood

	review1, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: alice.ID, DjID: dj1.ID, EventID: &event1.ID,
		RatingHalfStars: int16Ptr(9),
		ReviewText:      strPtr("Absolutely electric set, the buildup into the last hour was insane."),
		CrowdVibe:       &electric,
		CrowdVibeNote:   strPtr("Packed floor, everyone locked in."),
		SeenAt:          event1.EventDate,
	})
	if err != nil {
		return err
	}

	if _, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: bob.ID, DjID: dj2.ID,
		RatingHalfStars: int16Ptr(7),
		ReviewText:      strPtr("Solid deep house groove, warmed up the room well."),
		CrowdVibe:       &good,
		SeenAt:          mustParse("2026-05-01T22:00:00Z"),
	}); err != nil {
		return err
	}

	review3, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: bob.ID, DjID: dj3.ID,
		RatingHalfStars: int16Ptr(8),
		ReviewText:      strPtr("Static Bloom's low end was unreal, floor was shaking all night."),
		CrowdVibe:       &electric,
		SeenAt:          mustParse("2026-04-10T22:00:00Z"),
	})
	if err != nil {
		return err
	}

	if err := queries.Follow(ctx, pool, bob.ID, alice.ID); err != nil {
		return err
	}

	if err := queries.LikeReview(ctx, pool, review1.ID, bob.ID); err != nil {
		return err
	}
	if err := queries.LikeReview(ctx, pool, review3.ID, alice.ID); err != nil {
		return err
	}

	if _, err := queries.AddComment(ctx, pool, review1.ID, bob.ID, "Wish I was there for this one!"); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, review3.ID, alice.ID, "Adding this to my list."); err != nil {
		return err
	}

	return nil
}

func strPtr(s string) *string { return &s }
func int16Ptr(n int16) *int16 { return &n }

func mustParse(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}
