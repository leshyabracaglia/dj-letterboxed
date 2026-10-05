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

	// alice has an avatar; bob deliberately doesn't, to exercise the
	// no-avatar (initials) fallback in the Avatar component locally.
	alice, err := queries.CreateUser(ctx, pool, "seed_alice", "alice", strPtr("Alice"), strPtr("Techno head, always front row."), strPtr("https://i.pravatar.cc/300?img=47"))
	if err != nil {
		return err
	}
	bob, err := queries.CreateUser(ctx, pool, "seed_bob", "bob", strPtr("Bob"), strPtr("House music, warehouse parties."), nil)
	if err != nil {
		return err
	}

	// Dixon and Adam Ten have images; Yamagucci deliberately doesn't, to
	// exercise the no-image DJ fallback locally too.
	dj1, err := queries.CreateDj(ctx, pool, "Dixon", "dixon", strPtr("Innervisions co-founder, deep and melodic house."), []string{"house", "melodic house"}, nil, strPtr("https://picsum.photos/seed/dixon-dj/600/600"), alice.ID)
	if err != nil {
		return err
	}
	dj2, err := queries.CreateDj(ctx, pool, "Adam Ten", "adam-ten", strPtr("Melodic house and techno producer."), []string{"house", "melodic techno"}, nil, strPtr("https://picsum.photos/seed/adam-ten-dj/600/600"), bob.ID)
	if err != nil {
		return err
	}
	dj3, err := queries.CreateDj(ctx, pool, "Yamagucci", "yamagucci", strPtr("Tech house selector, no filler."), []string{"tech house", "house"}, nil, nil, alice.ID)
	if err != nil {
		return err
	}

	// Innervisions New York 2026 at Knockdown Center (Sat Jul 18): a day
	// party in The Ruins rolling into a night in the Main Hall. Desiree has
	// no reviews, to exercise a lineup DJ nobody has logged yet.
	dj4, err := queries.CreateDj(ctx, pool, "Âme", "ame", strPtr("Innervisions co-founder alongside Dixon; plays both DJ and live sets."), []string{"house", "melodic house"}, nil, strPtr("https://picsum.photos/seed/ame-dj/600/600"), alice.ID)
	if err != nil {
		return err
	}
	dj5, err := queries.CreateDj(ctx, pool, "Jimi Jules", "jimi-jules", strPtr("Swiss producer and Innervisions regular, vocal-led house."), []string{"house", "indie dance"}, nil, strPtr("https://picsum.photos/seed/jimi-jules-dj/600/600"), bob.ID)
	if err != nil {
		return err
	}
	dj6, err := queries.CreateDj(ctx, pool, "DESIREE", "desiree", strPtr("South African DJ, afro and deep house."), []string{"afro house", "deep house"}, nil, nil, alice.ID)
	if err != nil {
		return err
	}
	dj7, err := queries.CreateDj(ctx, pool, "Julya Karma", "julya-karma", strPtr("Berlin-based DJ and producer, hypnotic melodic grooves."), []string{"melodic house", "techno"}, nil, strPtr("https://picsum.photos/seed/julya-karma-dj/600/600"), bob.ID)
	if err != nil {
		return err
	}
	dj8, err := queries.CreateDj(ctx, pool, "Trikk", "trikk", strPtr("Portuguese producer, percussive and textured house."), []string{"house", "deep house"}, nil, nil, bob.ID)
	if err != nil {
		return err
	}

	knockdown, err := queries.UpsertUnlinkedVenue(ctx, pool, "Knockdown Center", strPtr("Maspeth, NY"), alice.ID)
	if err != nil {
		return err
	}
	innervisions, err := queries.CreateSeries(ctx, pool, "Innervisions", "innervisions", alice.ID)
	if err != nil {
		return err
	}
	event1, err := queries.CreateEvent(ctx, pool, "Innervisions New York", &innervisions.ID, knockdown, strPtr("Maspeth, NY"),
		mustParse("2026-07-18T18:00:00Z"),
		strPtr("Innervisions returns to Knockdown Center, taking over The Ruins and Main Hall. Day: DESIREE, Jimi Jules, Julya Karma, Trikk. Night: Âme (DJ + live), Dixon, Jimi Jules."),
		alice.ID)
	if err != nil {
		return err
	}
	if err := queries.AddToLineup(ctx, pool, event1.ID, []string{dj1.ID, dj4.ID, dj5.ID, dj6.ID, dj7.ID, dj8.ID}, alice.ID); err != nil {
		return err
	}

	review1, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: alice.ID, DjID: &dj1.ID, EventID: &event1.ID,
		Rating:     int16Ptr(5),
		ReviewText: strPtr("Absolutely electric set, the buildup into the last hour in the Main Hall was insane."),
		SeenAt:     event1.EventDate,
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review1.ID, alice.ID, []string{"electric", "packed", "night"}); err != nil {
		return err
	}

	review4, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: alice.ID, DjID: &dj4.ID, EventID: &event1.ID,
		Rating:     int16Ptr(5),
		ReviewText: strPtr("The live set was the highlight of the night, that room was made for it."),
		SeenAt:     event1.EventDate,
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review4.ID, alice.ID, []string{"night", "emotional"}); err != nil {
		return err
	}

	review5, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: bob.ID, DjID: &dj5.ID, EventID: &event1.ID,
		Rating:     int16Ptr(4),
		ReviewText: strPtr("Caught him in The Ruins at golden hour, perfect vibe for the open air."),
		SeenAt:     event1.EventDate,
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review5.ID, bob.ID, []string{"day", "sunset"}); err != nil {
		return err
	}

	review6, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: bob.ID, DjID: &dj7.ID, EventID: &event1.ID,
		Rating:     int16Ptr(3),
		ReviewText: strPtr("Nice hypnotic stuff but the early slot meant half the crowd was still in line."),
		SeenAt:     event1.EventDate,
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review6.ID, bob.ID, []string{"day"}); err != nil {
		return err
	}

	review7, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: bob.ID, DjID: &dj8.ID, EventID: &event1.ID,
		Rating: int16Ptr(4),
		SeenAt: event1.EventDate,
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review7.ID, bob.ID, []string{"day"}); err != nil {
		return err
	}

	// A review of the night as a whole (no DJ).
	review8, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: alice.ID, EventID: &event1.ID,
		Rating:     int16Ptr(5),
		ReviewText: strPtr("Day into night at Knockdown is the best format in the city. Sound in the Main Hall was dialed."),
		SeenAt:     event1.EventDate,
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review8.ID, alice.ID, []string{"day", "night", "packed"}); err != nil {
		return err
	}

	review2, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: bob.ID, DjID: &dj2.ID,
		Rating:     int16Ptr(4),
		ReviewText: strPtr("Solid deep house groove, warmed up the room well."),
		SeenAt:     mustParse("2026-05-01T22:00:00Z"),
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review2.ID, bob.ID, []string{"relaxed", "older crowd"}); err != nil {
		return err
	}

	review3, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
		UserID: bob.ID, DjID: &dj3.ID,
		Rating:     int16Ptr(4),
		ReviewText: strPtr("Yamagucci's low end was unreal, floor was shaking all night."),
		SeenAt:     mustParse("2026-04-10T22:00:00Z"),
	})
	if err != nil {
		return err
	}
	if err := queries.SetReviewTagLinks(ctx, pool, review3.ID, bob.ID, []string{"electric", "sweaty", "bass in your chest"}); err != nil {
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
	if err := queries.LikeReview(ctx, pool, review4.ID, bob.ID); err != nil {
		return err
	}
	if err := queries.LikeReview(ctx, pool, review5.ID, alice.ID); err != nil {
		return err
	}
	if err := queries.LikeReview(ctx, pool, review8.ID, bob.ID); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, review4.ID, bob.ID, "Missed Âme live, was stuck at the bar. Never again."); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, review5.ID, alice.ID, "The Ruins at sunset is unbeatable."); err != nil {
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
