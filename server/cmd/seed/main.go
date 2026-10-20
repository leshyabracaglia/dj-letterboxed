// Command seed inserts fixed dev fixture data. Purely additive (no
// truncation beforehand), so run it against a freshly migrated database.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
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

	// logNight saves one person's night out: its text and tags, the DJs they
	// saw, with anything they wrote about each set, and their tracks.
	logNight := func(n night) (*db.Review, error) {
		var eventID, text *string
		if n.event != nil {
			eventID = &n.event.ID
		}
		if n.text != "" {
			text = &n.text
		}
		r, err := queries.CreateReview(ctx, pool, queries.CreateReviewParams{
			UserID: n.user.ID, EventID: eventID, Venue: n.venue, City: n.venue.City,
			SeenAt: mustParse(n.seenAt), IsDay: n.isDay, IsNight: n.isNight || !n.isDay,
			ReviewText: text,
		})
		if err != nil {
			return nil, err
		}
		lineup := make([]queries.LineupInput, len(n.lineup))
		for i, s := range n.lineup {
			lineup[i] = queries.LineupInput{DjID: s.dj.ID}
			if s.text != "" {
				lineup[i].ReviewText = &s.text
			}
		}
		if err := queries.AddReviewLineup(ctx, pool, r.ID, lineup); err != nil {
			return nil, err
		}
		tracks := make([]queries.TrackInput, len(n.tracks))
		for i, t := range n.tracks {
			tracks[i] = t.input()
		}
		if err := queries.AddReviewTracks(ctx, pool, r.ID, tracks); err != nil {
			return nil, err
		}
		if len(n.tags) == 0 {
			return r, nil
		}
		return r, queries.SetReviewTagLinks(ctx, pool, r.ID, n.user.ID, n.tags)
	}

	// Innervisions New York 2026 at Knockdown Center (Sat Jul 18): alice and
	// bob both went at night (separate reviews of the same event), and bob
	// also logged the day party in The Ruins - same event, same day, day
	// instead of night. Nobody writes about DESIREE, to exercise a lineup DJ
	// with no reviews yet; the day's four-DJ lineup overflows a feed card's three
	// photo tiles ("+1 more"), two of them without images.
	aliceNight, err := logNight(night{
		user: alice, event: innervisions, venue: knockdown, seenAt: "2026-07-18T18:00:00Z", isNight: true,
		text: "Day into night at Knockdown is the best format in the city. Sound in the Main Hall was dialed.",
		tags: []string{"packed", "great sound"},
		lineup: []set{
			wrote(dj1, "Absolutely electric set, the buildup into the last hour in the Main Hall was insane."),
			wrote(dj4, "The live set was the highlight of the night, that room was made for it."),
			seen(dj5),
		},
		// One of each kind of track: Spotify with a note, SoundCloud with
		// none, and a Shazam from the night as a whole (no DJ).
		tracks: []track{
			onSpotify(dj1, "3rYAvF4f1aTbQ5hrIpcCPk", "Rej", "Âme", "The whole Main Hall sang the riff back at him."),
			onSoundCloud(dj4, "ame-live/hypnotic-live-edit", "Hypnotic (Live Edit)", "Âme", ""),
			shazamed(nil, "1787023936", "Movin' To The Sun", "HUGEL, Imael Angel & Ultra Naté", "Shazamed it in the smoking area between sets."),
		},
	})
	if err != nil {
		return err
	}

	// The e2e suite (e2e/) asserts on how many nights Dixon was seen on
	// (this one, alice's above and bob's at Nowadays below) - keep them in
	// sync if you change them.
	if _, err := logNight(night{
		user: bob, event: innervisions, venue: knockdown, seenAt: "2026-07-18T18:00:00Z", isNight: true,
		tags:   []string{"packed"},
		lineup: []set{wrote(dj1, "Dixon closing the Main Hall was pure tension and release, if a bit long."), seen(dj4), seen(dj5)},
		// Rej again, from Apple Music this time (it still counts once on
		// Dixon's page), and an ID nobody's named yet.
		tracks: []track{
			onAppleMusic(dj1, "1440841766", "Rej", "Âme", "Still the best record Innervisions ever put out."),
			unidentified(dj1, "ID - the one with the strings that came in around 4am. Anyone?"),
		},
	}); err != nil {
		return err
	}

	bobDay, err := logNight(night{
		user: bob, event: innervisions, venue: knockdown, seenAt: "2026-07-18T18:00:00Z", isDay: true,
		text: "The Ruins in the sun with this lineup back to back. Lines were long but worth it.",
		tags: []string{"sunny", "friendly", "sunset"},
		lineup: []set{
			wrote(dj5, "Caught him in The Ruins at golden hour, perfect vibe for the open air."),
			seen(dj6),
			wrote(dj7, "Nice hypnotic stuff but the early slot meant half the crowd was still in line."),
			seen(dj8),
		},
	})
	if err != nil {
		return err
	}

	// A one-off Dixon night at a second venue.
	if _, err := logNight(night{
		user: bob, event: dixonAllNight, venue: nowadays, seenAt: "2026-08-22T18:00:00Z", isNight: true,
		lineup: []set{wrote(dj1, "Seven hours of Dixon at Nowadays, never once lost the room.")},
		// Rej a third time (top of Dixon's tracks), with no note; a track
		// typed in by hand; and a long title.
		tracks: []track{
			shazamed(dj1, "1440841999", "Rej", "Âme", ""),
			typedIn(dj1, "Strings of Life (Dixon Edit)", "Rhythim Is Rhythim", "Unreleased as far as I can tell."),
			onSpotify(dj1, "5u9dC7LBrHZ6QRlU4xPEW3", "Sun Child (Extended Mix) [Innervisions Remastered Edition, Part Two]", "Dixon, Âme, Henrik Schwarz", ""),
		},
	}); err != nil {
		return err
	}

	// Nights with no event name, just a venue.
	if _, err := logNight(night{
		user: bob, venue: publicRecords, seenAt: "2026-05-01T22:00:00Z", isNight: true,
		tags:   []string{"chill", "older crowd"},
		lineup: []set{wrote(dj2, "Solid deep house groove, warmed up the room well.")},
	}); err != nil {
		return err
	}
	bobElsewhere, err := logNight(night{
		user: bob, venue: elsewhere, seenAt: "2026-04-10T22:00:00Z", isNight: true,
		tags:   []string{"sweaty", "bass in your chest"},
		lineup: []set{wrote(dj3, "Yamagucci's low end was unreal, floor was shaking all night.")},
	})
	if err != nil {
		return err
	}

	if _, err := queries.Follow(ctx, pool, bob.ID, alice.ID); err != nil {
		return err
	}

	if _, err := queries.LikeReview(ctx, pool, aliceNight.ID, bob.ID); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, bobElsewhere.ID, alice.ID); err != nil {
		return err
	}
	if _, err := queries.LikeReview(ctx, pool, bobDay.ID, alice.ID); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, aliceNight.ID, bob.ID, "Wish I was there for this one!"); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, aliceNight.ID, bob.ID, "Missed Âme live, was stuck at the bar. Never again."); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, bobElsewhere.ID, alice.ID, "Adding this to my list."); err != nil {
		return err
	}
	if _, err := queries.AddComment(ctx, pool, bobDay.ID, alice.ID, "The Ruins at sunset is unbeatable."); err != nil {
		return err
	}

	return seedVariations(ctx, pool, alice, bob, logNight)
}

// night is one person's night out to seed; set is a DJ on its lineup,
// written about (a DJ review) or just seen.
type (
	night struct {
		user    *db.User
		event   *db.Event
		venue   *db.Venue
		seenAt  string
		isDay   bool
		isNight bool
		text    string
		tags    []string
		lineup  []set
		tracks  []track
	}
	set struct {
		dj   *db.Dj
		text string
	}
	logNightFunc func(n night) (*db.Review, error)
)

func seen(dj *db.Dj) set               { return set{dj: dj} }
func wrote(dj *db.Dj, text string) set { return set{dj: dj, text: text} }

// track is a track highlighted on a night: dj is who played it (nil for one
// from the night as a whole). Build one with the helpers below, one per
// source a track can come from.
type track struct {
	dj                                        *db.Dj
	source, id, url, title, artist, art, note string
}

func (t track) input() queries.TrackInput {
	in := queries.TrackInput{Source: t.source, Title: optStr(t.title), Artist: optStr(t.artist), Note: optStr(t.note)}
	if t.dj != nil {
		in.DjID = &t.dj.ID
	}
	if t.source != domain.TrackSourceManual {
		in.ExternalID, in.URL, in.ArtworkURL = &t.id, &t.url, optStr(t.art)
	}
	return in
}

func optStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// seedArt is stand-in cover art (seeded tracks' ids aren't real).
func seedArt(id string) string { return "https://picsum.photos/seed/track-" + id + "/300/300" }

func onSpotify(dj *db.Dj, id, title, artist, note string) track {
	return track{dj, domain.TrackSourceSpotify, id, "https://open.spotify.com/track/" + id, title, artist, seedArt(id), note}
}

func onSoundCloud(dj *db.Dj, path, title, artist, note string) track {
	return track{dj, domain.TrackSourceSoundCloud, path, "https://soundcloud.com/" + path, title, artist, seedArt(path), note}
}

func onAppleMusic(dj *db.Dj, id, title, artist, note string) track {
	return track{dj, domain.TrackSourceApple, id, "https://music.apple.com/us/song/" + id, title, artist, seedArt(id), note}
}

func shazamed(dj *db.Dj, id, title, artist, note string) track {
	return track{dj, domain.TrackSourceShazam, id, "https://www.shazam.com/song/" + id, title, artist, seedArt(id), note}
}

func typedIn(dj *db.Dj, title, artist, note string) track {
	return track{dj: dj, source: domain.TrackSourceManual, title: title, artist: artist, note: note}
}

// unidentified is an "ID - ID": a track nobody's named yet, just a note.
func unidentified(dj *db.Dj, note string) track {
	return track{dj: dj, source: domain.TrackSourceManual, note: note}
}

// seedVariations adds nights covering each shape a card, DJ, event or venue
// page has to handle: with and without an event name, no/one/several DJs,
// no/some/every set written about, a night with nothing said about it,
// day/night/day-into-night, long and empty text, tracks of every kind (each
// source, typed in, unidentified, from the night, a full ten), tagged
// friends, a popular post, another city. It deliberately stays clear of what e2e/ asserts on
// (Dixon, Knockdown Center, Innervisions New York, Dixon All Night Long), so
// those counts don't move.
func seedVariations(ctx context.Context, pool queries.DBTX, alice, bob *db.User, logNight logNightFunc) (err error) {
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

	log := func(n night) *db.Review { return must(logNight(n)) }

	// Event, one DJ, nothing said about the set itself, by two people:
	// KETTAMA seen twice on his page.
	rushNight := log(night{
		user: carla, event: rush, venue: goodRoom, seenAt: "2026-10-03T22:00:00Z", isNight: true,
		text: "Two hours of breaks and big piano house. Good Room's back room was a sauna.",
		tags: []string{"sweaty", "packed"}, lineup: []set{seen(kettama)},
	})
	log(night{
		user: dev, event: rush, venue: goodRoom, seenAt: "2026-10-03T22:00:00Z", isNight: true,
		text: "Too many edits of the same three tracks.", lineup: []set{seen(kettama)},
	})
	// Good Room has a location and carla checked in there that night, so her
	// review is verified; dev's, the same night without a check-in, isn't.
	must(pool.Exec(ctx, "UPDATE venues SET latitude = 40.7268, longitude = -73.9526 WHERE id = $1", goodRoom.ID))
	must(pool.Exec(ctx, `
		INSERT INTO check_ins (user_id, venue_id, distance_m, accuracy_m, created_at)
		VALUES ($1, $2, 40, 12, '2026-10-04T02:30:00Z')`, carla.ID, goodRoom.ID))

	// Event, one DJ written about and nothing said about the night: it shows
	// as that DJ's review.
	honeyNight := log(night{
		user: alice, event: misterSat, venue: nowadays, seenAt: "2026-09-20T16:00:00Z", isDay: true, isNight: true,
		tags:   []string{"sunset", "friendly"},
		lineup: []set{wrote(honey, "House music church. The garden at golden hour.")},
		tracks: []track{onSpotify(honey, "0r4bwyQf8rTn6CBOEHTgAp", "Thinking of You", "Sister Sledge", "")},
	})

	// Event, several DJs, none written about: lineup photo tiles, no sets. Two DJs
	// leaves the row of three short; six overflows it ("+3 more").
	log(night{
		user: carla, event: misterSat, venue: nowadays, seenAt: "2026-08-30T16:00:00Z", isDay: true,
		text: "Sunday afternoon in the garden, couldn't have asked for more.", tags: []string{"sunny"},
		lineup: []set{seen(joy), seen(peggy)},
	})
	log(night{
		user: bob, event: basementEvent, venue: basement, seenAt: "2026-09-12T23:00:00Z", isNight: true,
		tags:   []string{"dark", "great sound"},
		lineup: []set{seen(benUFO), seen(joy), seen(mallGrab), seen(peggy), seen(shygirl), seen(djPython)},
	})

	// Event, several DJs, nothing said about the night itself: each set
	// written about listed, and "Also saw" for the rest.
	log(night{
		user: carla, event: basementEvent, venue: basement, seenAt: "2026-09-12T23:00:00Z", isNight: true,
		lineup: []set{
			wrote(benUFO, "Three-hour masterclass in the Ford room, never played an obvious record."),
			seen(joy),
			seen(mallGrab), seen(shygirl),
		},
	})

	// Event, several DJs, most sets written about, more sets than a list card shows
	// ("+N more sets"), day into night, a long review.
	marathonNight := log(night{
		user: bob, event: marathon, venue: mirage, seenAt: "2026-07-04T14:00:00Z", isDay: true, isNight: true,
		text: "Got there at two in the afternoon and left after sunrise. Floating Points opened with an hour of jazz records " +
			"nobody recognised and somehow ended on acid techno, and the whole room went with him the entire way. The sound in the Mirage was the " +
			"best I've heard it, the crowd was kind, the water was free. If they do this again I'm taking the next day off work too.",
		tags: []string{"emotional", "great sound", "packed"},
		lineup: []set{
			wrote(floating, "Best set of the year, no contest."),
			wrote(djPython, "Perfect warm-up while it was still light out."),
			seen(honey),
			wrote(peggy, "Fun but felt short after the marathon before it."),
		},
		// The most tracks a night can have (maxTracks), across every DJ and
		// the night itself: more than a list card shows. Honey Dijon's set
		// has no words, only a track (picked on two nights, so it tops her
		// page).
		tracks: []track{
			onSpotify(floating, "1x2y3z4a5b6c7d8e9f0g1h", "LesAlpx", "Floating Points", "Played it twice. Nobody minded."),
			onSpotify(floating, "2x2y3z4a5b6c7d8e9f0g1h", "Silhouettes (I, II & III)", "Floating Points", ""),
			onAppleMusic(floating, "1500000001", "Spiral", "Pharoah Sanders", "Ten minutes of spiritual jazz at peak time, and it worked."),
			unidentified(floating, "The acid track he closed on. Sounded like a 303 falling down the stairs. If anyone knows it, I need it. "+
				"I've been through every Shazam in my history and the only thing it caught was the crowd screaming."),
			onSoundCloud(djPython, "djpython/dulce-edit", "Dulce (Edit)", "DJ Python", ""),
			onSpotify(honey, "0r4bwyQf8rTn6CBOEHTgAp", "Thinking of You", "Sister Sledge", "Dropped this at sunset and the whole room went."),
			shazamed(peggy, "1500000002", "Starry Night", "Peggy Gou", ""),
			typedIn(peggy, "It Makes You Forget (Itgehane)", "Peggy Gou", ""),
			typedIn(nil, "The encore record", "", "Whatever the last record was, after the lights came up. Everyone stayed."),
			shazamed(nil, "1500000003", "Your Love", "Frankie Knuckles", "Played on the PA while we waited outside."),
		},
	})

	// No event, one DJ: titled after the DJ, venue under it.
	log(night{
		user: alice, venue: leBain, seenAt: "2026-09-27T23:00:00Z", isNight: true,
		text: "Rooftop, slow and hazy, exactly right for the last warm weekend.", tags: []string{"chill"},
		lineup: []set{seen(djPython)},
	})

	// No event, two DJs, one set written about: titled "A · B".
	b2bNight := log(night{
		user: carla, venue: mirage, seenAt: "2026-08-15T21:00:00Z", isNight: true,
		text: "Big room, big sound, too many phones.", tags: []string{"packed"},
		lineup: []set{seen(peggy), wrote(shygirl, "Way harder than I expected, loved it.")},
	})

	// No event, no lineup: titled after the venue (a city-less one).
	log(night{
		user: dev, venue: warehouse, seenAt: "2026-06-20T23:00:00Z", isNight: true,
		text: "No idea who was playing, didn't matter. Lost my jacket.",
	})

	// No event, several DJs, one set written about, day only.
	log(night{
		user: dev, venue: goodRoom, seenAt: "2026-09-06T15:00:00Z", isDay: true,
		tags:   []string{"older crowd"},
		lineup: []set{wrote(mallGrab, "Lo-fi house on a sunny afternoon, it was fine."), seen(joy)},
		// Nothing written about Joy's set, just a track: it still shows as
		// a set.
		tracks: []track{onSoundCloud(joy, "joyorbison/flight-fm", "Flight FM", "Joy Orbison", "The one track that got the whole patio moving.")},
	})

	// Another city, for the location-based search and city picker.
	fabricNight := log(night{
		user: dev, event: fabricLive, venue: fabric, seenAt: "2026-05-16T23:00:00Z", isNight: true,
		text: "Room One at 4am. Nothing like it.", tags: []string{"bass in your chest"},
		lineup: []set{seen(benUFO), seen(joy)},
	})

	// Friends tagged on posts ("With @…" on the review page).
	must(0, queries.SetReviewTags(ctx, pool, rushNight.ID, []string{dev.ID}))
	must(0, queries.SetReviewTags(ctx, pool, marathonNight.ID, []string{alice.ID, carla.ID}))

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
		{marathonNight, []*db.User{alice, carla, dev}},
		{rushNight, []*db.User{alice, bob}},
		{honeyNight, []*db.User{carla}},
		{b2bNight, []*db.User{bob}},
		{fabricNight, []*db.User{bob, carla}},
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
		{marathonNight, alice, "Jealous. Was it really twelve hours?"},
		{marathonNight, bob, "Thirteen with the encore."},
		{marathonNight, carla, "I was by the left speaker the whole time!"},
		{marathonNight, dev, "Next year I'm coming."},
		{rushNight, dev, "Fair, but it was way too hot in there."},
	} {
		must(queries.AddComment(ctx, pool, c.review.ID, c.user.ID, c.body))
	}

	// Profile favorites, in order.
	must(0, queries.SetFavoriteReviews(ctx, pool, bob.ID, []string{marathonNight.ID}))
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

func mustParse(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}
