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
	nowadays, err := queries.UpsertUnlinkedVenue(ctx, pool, "Nowadays", strPtr("Ridgewood, NY"), bob.ID)
	if err != nil {
		return err
	}
	publicRecords, err := queries.UpsertUnlinkedVenue(ctx, pool, "Public Records", strPtr("Brooklyn, NY"), bob.ID)
	if err != nil {
		return err
	}
	elsewhere, err := queries.UpsertUnlinkedVenue(ctx, pool, "Elsewhere", strPtr("Brooklyn, NY"), bob.ID)
	if err != nil {
		return err
	}

	innervisions, err := queries.CreateEvent(ctx, pool, "Innervisions New York", "innervisions-new-york", alice.ID)
	if err != nil {
		return err
	}
	dixonAllNight, err := queries.CreateEvent(ctx, pool, "Dixon All Night Long", "dixon-all-night-long", bob.ID)
	if err != nil {
		return err
	}

	// logNight saves one person's night out and the DJs they saw.
	logNight := func(user *db.User, event *db.Event, venue *db.Venue, seenAt string, isDay, isNight bool, lineup ...*db.Dj) (*db.Log, error) {
		var eventID *string
		if event != nil {
			eventID = &event.ID
		}
		l, err := queries.CreateLog(ctx, pool, queries.CreateLogParams{
			UserID: user.ID, EventID: eventID, Venue: venue, City: venue.City,
			SeenAt: mustParse(seenAt), IsDay: isDay, IsNight: isNight,
		})
		if err != nil {
			return nil, err
		}
		ids := make([]string, len(lineup))
		for i, d := range lineup {
			ids[i] = d.ID
		}
		return l, queries.AddLogLineup(ctx, pool, l.ID, ids)
	}
	// review adds a review to a log: of a DJ, or of the night (dj nil).
	review := func(l *db.Log, dj *db.Dj, rating int16, text string, tags ...string) (*db.Review, error) {
		var djID, reviewText *string
		if dj != nil {
			djID = &dj.ID
		}
		if text != "" {
			reviewText = &text
		}
		r, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
			Log: l, DjID: djID, Rating: int16Ptr(rating), ReviewText: reviewText,
		})
		if err != nil || len(tags) == 0 {
			return r, err
		}
		return r, queries.SetReviewTagLinks(ctx, pool, r.ID, l.UserID, tags)
	}

	// Innervisions New York 2026 at Knockdown Center (Sat Jul 18): alice and
	// bob both went at night (separate logs of the same event), and bob also
	// logged the day party in The Ruins - same event, same day, day instead
	// of night. DESIREE has no reviews, to exercise a lineup DJ nobody has
	// rated yet; the day log's four-DJ lineup overflows a feed card's three
	// photo tiles ("+1 more"), two of them without images.
	aliceNight, err := logNight(alice, innervisions, knockdown, "2026-07-18T18:00:00Z", false, true, dj1, dj4, dj5)
	if err != nil {
		return err
	}
	review1, err := review(aliceNight, dj1, 5, "Absolutely electric set, the buildup into the last hour in the Main Hall was insane.", "groovy", "packed")
	if err != nil {
		return err
	}
	review4, err := review(aliceNight, dj4, 5, "The live set was the highlight of the night, that room was made for it.", "emotional")
	if err != nil {
		return err
	}
	// A review of the night as a whole (no DJ).
	review8, err := review(aliceNight, nil, 5, "Day into night at Knockdown is the best format in the city. Sound in the Main Hall was dialed.", "packed", "great sound")
	if err != nil {
		return err
	}

	// The e2e suite (e2e/) asserts on Dixon's three reviews (this one, alice's
	// above and bob's at Nowadays below) - keep them in sync if you change
	// them.
	bobNight, err := logNight(bob, innervisions, knockdown, "2026-07-18T18:00:00Z", false, true, dj1, dj4, dj5)
	if err != nil {
		return err
	}
	if _, err := review(bobNight, dj1, 4, "Dixon closing the Main Hall was pure tension and release, if a bit long.", "packed"); err != nil {
		return err
	}

	bobDay, err := logNight(bob, innervisions, knockdown, "2026-07-18T18:00:00Z", true, false, dj5, dj6, dj7, dj8)
	if err != nil {
		return err
	}
	review5, err := review(bobDay, dj5, 4, "Caught him in The Ruins at golden hour, perfect vibe for the open air.", "sunset")
	if err != nil {
		return err
	}
	if _, err := review(bobDay, dj7, 3, "Nice hypnotic stuff but the early slot meant half the crowd was still in line."); err != nil {
		return err
	}
	if _, err := review(bobDay, dj8, 4, ""); err != nil {
		return err
	}
	if _, err := review(bobDay, nil, 4, "The Ruins in the sun with this lineup back to back. Lines were long but worth it.", "sunny", "friendly"); err != nil {
		return err
	}

	// A one-off Dixon night at a second venue.
	bobNowadays, err := logNight(bob, dixonAllNight, nowadays, "2026-08-22T18:00:00Z", false, true, dj1)
	if err != nil {
		return err
	}
	if _, err := review(bobNowadays, dj1, 5, "Seven hours of Dixon at Nowadays, never once lost the room."); err != nil {
		return err
	}

	// Nights with no event name, just a venue.
	bobPublicRecords, err := logNight(bob, nil, publicRecords, "2026-05-01T22:00:00Z", false, true, dj2)
	if err != nil {
		return err
	}
	if _, err := review(bobPublicRecords, dj2, 4, "Solid deep house groove, warmed up the room well.", "relaxed", "older crowd"); err != nil {
		return err
	}
	bobElsewhere, err := logNight(bob, nil, elsewhere, "2026-04-10T22:00:00Z", false, true, dj3)
	if err != nil {
		return err
	}
	review3, err := review(bobElsewhere, dj3, 4, "Yamagucci's low end was unreal, floor was shaking all night.", "sweaty", "bass in your chest")
	if err != nil {
		return err
	}

	if _, err := queries.Follow(ctx, pool, bob.ID, alice.ID); err != nil {
		return err
	}

	if _, err := queries.LikeReview(ctx, pool, review1.ID, bob.ID); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, review3.ID, alice.ID); err != nil {
		return err
	}

	if _, err := queries.AddComment(ctx, pool, review1.ID, bob.ID, "Wish I was there for this one!"); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, review3.ID, alice.ID, "Adding this to my list."); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, review4.ID, bob.ID); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, review5.ID, alice.ID); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, review8.ID, bob.ID); err != nil {
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
