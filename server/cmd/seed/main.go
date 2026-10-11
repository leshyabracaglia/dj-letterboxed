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
	if _, err := review(aliceNight, dj1, 5, "Absolutely electric set, the buildup into the last hour in the Main Hall was insane.", "groovy", "packed"); err != nil {
		return err
	}
	if _, err := review(aliceNight, dj4, 5, "The live set was the highlight of the night, that room was made for it.", "emotional"); err != nil {
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
	if _, err := review(bobDay, dj5, 4, "Caught him in The Ruins at golden hour, perfect vibe for the open air.", "sunset"); err != nil {
		return err
	}
	if _, err := review(bobDay, dj7, 3, "Nice hypnotic stuff but the early slot meant half the crowd was still in line."); err != nil {
		return err
	}
	if _, err := review(bobDay, dj8, 4, ""); err != nil {
		return err
	}
	bobDayNight, err := review(bobDay, nil, 4, "The Ruins in the sun with this lineup back to back. Lines were long but worth it.", "sunny", "friendly")
	if err != nil {
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
	if _, err := review(bobPublicRecords, dj2, 4, "Solid deep house groove, warmed up the room well.", "chill", "older crowd"); err != nil {
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

	// Likes and comments go on a night out's post: its night review when it
	// has one (logs.lead_review_id).
	if _, err := queries.LikeReview(ctx, pool, review8.ID, bob.ID); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, review3.ID, alice.ID); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, bobDayNight.ID, alice.ID); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, review8.ID, bob.ID, "Wish I was there for this one!"); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, review8.ID, bob.ID, "Missed Âme live, was stuck at the bar. Never again."); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, review3.ID, alice.ID, "Adding this to my list."); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, bobDayNight.ID, alice.ID, "The Ruins at sunset is unbeatable."); err != nil {
		return err
	}

	return seedVariations(ctx, pool, alice, bob, logNight, review)
}

type (
	logNightFunc func(user *db.User, event *db.Event, venue *db.Venue, seenAt string, isDay, isNight bool, lineup ...*db.Dj) (*db.Log, error)
	reviewFunc   func(l *db.Log, dj *db.Dj, rating int16, text string, tags ...string) (*db.Review, error)
)

// seedVariations adds nights covering each shape a card, DJ, event or venue
// page has to handle: with and without an event name, no/one/several DJs,
// night-only, DJ-only and mixed reviews, day/night/day-into-night, long and
// empty text, tagged friends, a popular post, another city. It deliberately
// stays clear of what e2e/ asserts on (Dixon, Knockdown Center, Innervisions
// New York, Dixon All Night Long), so those counts don't move.
func seedVariations(ctx context.Context, pool queries.DBTX, alice, bob *db.User, logNight logNightFunc, review reviewFunc) (err error) {
	// Fixture inserts can't fail on a fresh DB short of a schema bug, so
	// panic through them (like mustParse) and report the first error here.
	defer func() {
		if r := recover(); r != nil {
			if e, ok := r.(error); ok {
				err = e
				return
			}
			panic(r)
		}
	}()

	// carla has an avatar and follows both; dev has none, a long handle (for
	// the card's name tag) and follows nobody.
	carla := must(queries.CreateUser(ctx, pool, "seed_carla", "carla", strPtr("Carla"), strPtr("Afro house and anything outdoors."), strPtr("https://i.pravatar.cc/300?img=32")))
	dev := must(queries.CreateUser(ctx, pool, "seed_dev", "deep_house_dev_420", strPtr("Dev"), nil, nil))

	dj := func(name, slug string, bio *string, genres []string, image bool, by *db.User) *db.Dj {
		var imageURL *string
		if image {
			imageURL = strPtr("https://picsum.photos/seed/" + slug + "-dj/600/600")
		}
		return must(queries.CreateDj(ctx, pool, name, slug, bio, genres, nil, imageURL, by.ID))
	}
	// Floating Points' bio runs well past the DJ page's three-line clamp
	// ("Read more"); Mall Grab has no bio, genres or photo at all.
	kettama := dj("KETTAMA", "kettama", strPtr("Irish producer, breakbeat-laced house and techno."), []string{"house", "breaks"}, true, carla)
	honey := dj("Honey Dijon", "honey-dijon", strPtr("Chicago-born, New York-made house and disco."), []string{"house", "disco"}, true, alice)
	floating := dj("Floating Points", "floating-points", strPtr("Sam Shepherd: neuroscientist turned producer, composer and selector. "+
		"His sets wander from spiritual jazz and Brazilian records through deep house and disco to full-bore techno, often over many hours, "+
		"and he founded the Eglo label and plays live with a full ensemble. Known for marathon all-night sets that reward the people who stay "+
		"until the lights come up, and for digging out records nobody else in the room has heard."), []string{"house", "jazz", "electronica"}, true, bob)
	peggy := dj("Peggy Gou", "peggy-gou", strPtr("Berlin-based Korean DJ and producer."), []string{"house", "techno"}, true, carla)
	benUFO := dj("Ben UFO", "ben-ufo", strPtr("Hessle Audio co-founder."), []string{"techno", "uk bass"}, false, dev)
	mallGrab := dj("Mall Grab", "mall-grab", nil, nil, false, dev)
	joy := dj("Joy Orbison", "joy-orbison", strPtr("UK garage and house, Hinge Finger."), []string{"uk garage", "house"}, true, bob)
	shygirl := dj("Shygirl", "shygirl", strPtr("South London club music."), []string{"club"}, true, carla)
	djPython := dj("DJ Python", "dj-python", strPtr("Deep reggaeton, ambient-leaning sets."), []string{"deep reggaeton", "ambient"}, false, alice)

	venue := func(name string, city *string, by *db.User) *db.Venue {
		return must(queries.UpsertUnlinkedVenue(ctx, pool, name, city, by.ID))
	}
	goodRoom := venue("Good Room", strPtr("Brooklyn, NY"), carla)
	basement := venue("Basement", strPtr("Queens, NY"), bob)
	mirage := venue("Brooklyn Mirage", strPtr("Brooklyn, NY"), carla)
	leBain := venue("Le Bain", strPtr("New York, NY"), alice)
	fabric := venue("fabric", strPtr("London, UK"), dev)
	// Typed in with no city, like a warehouse with no listing.
	warehouse := venue("Secret Warehouse off Flushing Ave", nil, dev)
	nowadays := venue("Nowadays", strPtr("Ridgewood, NY"), bob) // already seeded: returns that row

	event := func(name, slug string, by *db.User) *db.Event {
		return must(queries.CreateEvent(ctx, pool, name, slug, by.ID))
	}
	rush := event("Rush: Kettama", "rush-kettama", carla)
	misterSat := event("Mister Saturday Night", "mister-saturday-night", bob)
	// Same name as its venue: cards show it once, not "Basement @ Basement".
	basementEvent := event("Basement", "basement", bob)
	marathon := event("Floating Points All Night Long - Twelve Hour Marathon Edition", "floating-points-all-night-long-twelve-hour-marathon-edition", bob)
	fabricLive := event("FABRICLIVE", "fabriclive", dev)

	night := func(user *db.User, e *db.Event, v *db.Venue, seenAt string, isDay, isNight bool, lineup ...*db.Dj) *db.Log {
		return must(logNight(user, e, v, seenAt, isDay, isNight, lineup...))
	}
	rate := func(l *db.Log, d *db.Dj, rating int16, text string, tags ...string) *db.Review {
		return must(review(l, d, rating, text, tags...))
	}

	// Event, one DJ, rated only as a whole night by two people: a solo night
	// counts toward KETTAMA's own rating (Avg of 2 on his page).
	rush1 := night(carla, rush, goodRoom, "2026-10-03T22:00:00Z", false, true, kettama)
	rushNight := rate(rush1, nil, 4, "Two hours of breaks and big piano house. Good Room's back room was a sauna.", "sweaty", "packed")
	rush2 := night(dev, rush, goodRoom, "2026-10-03T22:00:00Z", false, true, kettama)
	rate(rush2, nil, 2, "Too many edits of the same three tracks.")

	// Event, one DJ, rated only as the DJ: the DJ card.
	honeyNight := night(alice, misterSat, nowadays, "2026-09-20T16:00:00Z", true, true, honey)
	honeyReview := rate(honeyNight, honey, 5, "House music church. The garden at golden hour.", "sunset", "friendly")

	// Event, several DJs, night review only: lineup photo tiles, no sets.
	// Two DJs leaves the row of three short; six overflows it ("+3 more").
	misterDay := night(carla, misterSat, nowadays, "2026-08-30T16:00:00Z", true, false, joy, peggy)
	rate(misterDay, nil, 5, "Sunday afternoon in the garden, couldn't have asked for more.", "sunny")
	basementBig := night(bob, basementEvent, basement, "2026-09-12T23:00:00Z", false, true, benUFO, joy, mallGrab, peggy, shygirl, djPython)
	rate(basementBig, nil, 4, "", "dark", "great sound")

	// Event, several DJs, DJ reviews only (no night review): the night card
	// without its own stamp, each set listed, and "Also saw" for the rest.
	basementSets := night(carla, basementEvent, basement, "2026-09-12T23:00:00Z", false, true, benUFO, joy, mallGrab, shygirl)
	rate(basementSets, benUFO, 5, "Three-hour masterclass in the Ford room, never played an obvious record.")
	rate(basementSets, joy, 4, "")

	// Event, several DJs, night review plus every set rated, more sets than
	// a list card shows ("+N more sets"), day into night, a long review.
	marathonNight := night(bob, marathon, mirage, "2026-07-04T14:00:00Z", true, true, floating, djPython, honey, peggy)
	marathonLead := rate(marathonNight, nil, 5, "Got there at two in the afternoon and left after sunrise. Floating Points opened with an hour of jazz records "+
		"nobody recognised and somehow ended on acid techno, and the whole room went with him the entire way. The sound in the Mirage was the "+
		"best I've heard it, the crowd was kind, the water was free. If they do this again I'm taking the next day off work too.", "emotional", "great sound", "packed")
	rate(marathonNight, floating, 5, "Best set of the year, no contest.")
	rate(marathonNight, djPython, 4, "Perfect warm-up while it was still light out.")
	rate(marathonNight, honey, 4, "")
	rate(marathonNight, peggy, 3, "Fun but felt short after the marathon before it.")

	// No event, one DJ, night review: titled after the DJ, venue under it.
	pythonSolo := night(alice, nil, leBain, "2026-09-27T23:00:00Z", false, true, djPython)
	rate(pythonSolo, nil, 4, "Rooftop, slow and hazy, exactly right for the last warm weekend.", "chill")

	// No event, two DJs, night review plus one set: titled "A · B".
	b2b := night(carla, nil, mirage, "2026-08-15T21:00:00Z", false, true, peggy, shygirl)
	b2bNight := rate(b2b, nil, 3, "Big room, big sound, too many phones.", "packed")
	rate(b2b, shygirl, 4, "Way harder than I expected, loved it.")

	// No event, no lineup: titled after the venue (a city-less one).
	unknown := night(dev, nil, warehouse, "2026-06-20T23:00:00Z", false, true)
	rate(unknown, nil, 3, "No idea who was playing, didn't matter. Lost my jacket.")

	// No event, several DJs, one set rated (the DJ card), day only.
	mallGrabDay := night(dev, nil, goodRoom, "2026-09-06T15:00:00Z", true, false, mallGrab, joy)
	rate(mallGrabDay, mallGrab, 2, "Lo-fi house on a sunny afternoon, it was fine.", "older crowd")

	// Another city, for the location-based search and city picker.
	fabricNight := night(dev, fabricLive, fabric, "2026-05-16T23:00:00Z", false, true, benUFO, joy)
	fabricLead := rate(fabricNight, nil, 5, "Room One at 4am. Nothing like it.", "bass in your chest")
	rate(fabricNight, benUFO, 5, "")

	// Friends tagged on posts ("With @…" on the review page).
	must(0, queries.SetReviewTags(ctx, pool, rushNight.ID, []string{dev.ID}))
	must(0, queries.SetReviewTags(ctx, pool, marathonLead.ID, []string{alice.ID, carla.ID}))

	// carla follows both; alice follows carla back; dev follows nobody.
	for _, f := range [][2]*db.User{{carla, alice}, {carla, bob}, {alice, carla}, {bob, carla}} {
		must(queries.Follow(ctx, pool, f[0].ID, f[1].ID))
	}

	// The marathon is liked by everyone (a popular post); a spread of likes
	// and a comment thread elsewhere.
	for _, like := range []struct {
		review *db.Review
		users  []*db.User
	}{
		{marathonLead, []*db.User{alice, carla, dev}},
		{rushNight, []*db.User{alice, bob}},
		{honeyReview, []*db.User{carla}},
		{b2bNight, []*db.User{bob}},
		{fabricLead, []*db.User{bob, carla}},
	} {
		for _, u := range like.users {
			must(queries.LikeReview(ctx, pool, like.review.ID, u.ID))
		}
	}
	for _, c := range []struct {
		review *db.Review
		user   *db.User
		body   string
	}{
		{marathonLead, alice, "Jealous. Was it really twelve hours?"},
		{marathonLead, bob, "Thirteen with the encore."},
		{marathonLead, carla, "I was by the left speaker the whole time!"},
		{marathonLead, dev, "Next year I'm coming."},
		{rushNight, dev, "Fair, but it was way too hot in there."},
	} {
		must(queries.AddComment(ctx, pool, c.review.ID, c.user.ID, c.body))
	}

	// Profile favorites, in order.
	must(0, queries.SetFavoriteReviews(ctx, pool, bob.ID, []string{marathonLead.ID}))
	must(0, queries.SetFavoriteReviews(ctx, pool, carla.ID, []string{rushNight.ID, b2bNight.ID}))
	return nil
}

func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
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
