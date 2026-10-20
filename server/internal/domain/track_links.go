package domain

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Where a track on a review came from: picked from Spotify search, read off
// a pasted Spotify/SoundCloud/Apple Music/Shazam link, or typed in by hand.
const (
	TrackSourceSpotify    = "spotify"
	TrackSourceSoundCloud = "soundcloud"
	TrackSourceApple      = "apple"
	TrackSourceShazam     = "shazam"
	TrackSourceManual     = "manual"
)

var (
	// ErrUnsupportedLink is a pasted link that isn't a track on one of the
	// services above.
	ErrUnsupportedLink = errors.New("that isn't a Spotify, SoundCloud, Apple Music or Shazam track link")
	ErrTrackNotFound   = errors.New("couldn't find that track")
)

// TrackMatch is a track found on a music service, ready to be put on a
// review.
type TrackMatch struct {
	Source     string  `json:"source"`
	ExternalID string  `json:"externalId"`
	URL        *string `json:"url" extensions:"x-nullable"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	ArtworkURL *string `json:"artworkUrl" extensions:"x-nullable"`
}

// TrackLink is a pasted link, parsed: which service and which track. URL is
// the link rebuilt from those parts (or, for SoundCloud, as pasted minus
// its query), never anything else the paster put in it.
type TrackLink struct {
	Source  string
	ID      string
	Country string
	URL     string
}

var (
	spotifyIDPattern = regexp.MustCompile(`^[A-Za-z0-9]{22}$`)
	numericPattern   = regexp.MustCompile(`^[0-9]{1,15}$`)
	slugPattern      = regexp.MustCompile(`^[A-Za-z0-9_-]{1,100}$`)
	countryPattern   = regexp.MustCompile(`^[a-z]{2}$`)
)

// ParseTrackLink reads a pasted track link. It only knows each service's
// track URLs (not albums, playlists or profiles).
func ParseTrackLink(raw string) (*TrackLink, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return nil, ErrUnsupportedLink
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	parts := strings.FieldsFunc(u.Path, func(r rune) bool { return r == '/' })

	switch host {
	case "open.spotify.com":
		// /track/{id}, or /intl-de/track/{id}.
		if len(parts) >= 1 && strings.HasPrefix(parts[0], "intl-") {
			parts = parts[1:]
		}
		if len(parts) == 2 && parts[0] == "track" && spotifyIDPattern.MatchString(parts[1]) {
			return &TrackLink{Source: TrackSourceSpotify, ID: parts[1], URL: "https://open.spotify.com/track/" + parts[1]}, nil
		}
	case "soundcloud.com", "m.soundcloud.com":
		// /{artist}/{track}; /{artist}/sets/… is a playlist.
		if len(parts) == 2 && parts[1] != "sets" && slugPattern.MatchString(parts[0]) && slugPattern.MatchString(parts[1]) {
			link := "https://soundcloud.com/" + parts[0] + "/" + parts[1]
			return &TrackLink{Source: TrackSourceSoundCloud, ID: parts[0] + "/" + parts[1], URL: link}, nil
		}
	case "on.soundcloud.com":
		// A share short link; SoundCloud's oEmbed follows it.
		if len(parts) == 1 && slugPattern.MatchString(parts[0]) {
			return &TrackLink{Source: TrackSourceSoundCloud, URL: "https://on.soundcloud.com/" + parts[0]}, nil
		}
	case "music.apple.com":
		// /{country}/album/{slug}/{albumId}?i={trackId}, or
		// /{country}/song/{slug}/{trackId}.
		country := "us"
		if len(parts) >= 1 && countryPattern.MatchString(parts[0]) {
			country, parts = parts[0], parts[1:]
		}
		id := ""
		if len(parts) >= 1 && parts[0] == "album" {
			id = u.Query().Get("i")
		} else if len(parts) >= 2 && parts[0] == "song" {
			id = parts[len(parts)-1]
		}
		if numericPattern.MatchString(id) {
			return &TrackLink{
				Source: TrackSourceApple, ID: id, Country: country,
				URL: "https://music.apple.com/" + country + "/song/" + id,
			}, nil
		}
	case "shazam.com":
		// /song/{id}/{slug}; the id is the track's Apple Music id.
		if len(parts) >= 2 && parts[0] == "song" && numericPattern.MatchString(parts[1]) {
			return &TrackLink{Source: TrackSourceShazam, ID: parts[1], URL: "https://www.shazam.com/song/" + parts[1]}, nil
		}
	}
	return nil, ErrUnsupportedLink
}

// IsTrackArtworkURL is whether u is cover art from one of the services
// tracks come from - the only images a track on a review may show.
func IsTrackArtworkURL(u string) bool {
	parsed, err := url.Parse(u)
	if err != nil || parsed.Scheme != "https" {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	return host == "i.scdn.co" || strings.HasSuffix(host, ".sndcdn.com") || strings.HasSuffix(host, ".mzstatic.com")
}

type trackCacheEntry struct {
	match     *TrackMatch
	expiresAt time.Time
}

// TrackClient finds tracks to put on reviews: Spotify search, and reading a
// pasted link. Links are only ever looked up through each service's own
// fixed lookup endpoint (never fetched as given), and lookups are cached.
type TrackClient struct {
	spotify *SpotifyClient
	http    *http.Client
	ttl     time.Duration

	mu    sync.Mutex
	cache map[string]trackCacheEntry
}

func NewTrackClient(spotify *SpotifyClient) *TrackClient {
	return &TrackClient{
		spotify: spotify,
		http:    &http.Client{Timeout: 8 * time.Second},
		ttl:     24 * time.Hour,
		cache:   map[string]trackCacheEntry{},
	}
}

func (c *TrackClient) Search(ctx context.Context, query string) ([]TrackMatch, error) {
	return c.spotify.SearchTracks(ctx, query)
}

// Resolve reads a pasted track link into the track it points at.
func (c *TrackClient) Resolve(ctx context.Context, raw string) (*TrackMatch, error) {
	link, err := ParseTrackLink(raw)
	if err != nil {
		return nil, err
	}
	key := link.Source + ":" + link.URL
	c.mu.Lock()
	if e, ok := c.cache[key]; ok && e.expiresAt.After(time.Now()) {
		c.mu.Unlock()
		return e.match, nil
	}
	c.mu.Unlock()

	var match *TrackMatch
	switch link.Source {
	case TrackSourceSpotify:
		match, err = c.spotify.GetTrack(ctx, link.ID)
	case TrackSourceSoundCloud:
		match, err = c.soundCloud(ctx, link)
	case TrackSourceApple:
		match, err = c.appleMusic(ctx, link.ID, link.Country)
	case TrackSourceShazam:
		match, err = c.shazam(ctx, link)
	}
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	for k, e := range c.cache {
		if e.expiresAt.Before(time.Now()) {
			delete(c.cache, k)
		}
	}
	c.cache[key] = trackCacheEntry{match: match, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()
	return match, nil
}

// get fetches a fixed lookup URL, reading at most 1MB of the response.
func (c *TrackClient) get(ctx context.Context, u string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Beatboxd/1.0 (+https://beatboxd.com)")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		return nil, ErrTrackNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("track lookup failed: %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 1<<20))
}

// soundCloud reads a track through SoundCloud's oEmbed endpoint, which needs
// no API key. Its title is "{track} by {uploader}".
func (c *TrackClient) soundCloud(ctx context.Context, link *TrackLink) (*TrackMatch, error) {
	body, err := c.get(ctx, "https://soundcloud.com/oembed?format=json&url="+url.QueryEscape(link.URL))
	if err != nil {
		return nil, err
	}
	var data struct {
		Title        string `json:"title"`
		AuthorName   string `json:"author_name"`
		ThumbnailURL string `json:"thumbnail_url"`
	}
	if err := json.Unmarshal(body, &data); err != nil || data.Title == "" {
		return nil, ErrTrackNotFound
	}
	m := &TrackMatch{
		Source:     TrackSourceSoundCloud,
		ExternalID: link.ID,
		URL:        &link.URL,
		Title:      strings.TrimSuffix(data.Title, " by "+data.AuthorName),
		Artist:     data.AuthorName,
	}
	if m.ExternalID == "" {
		// A short link: the track is whatever it pointed at.
		m.ExternalID = link.URL
	}
	if data.ThumbnailURL != "" {
		m.ArtworkURL = &data.ThumbnailURL
	}
	return m, nil
}

// appleMusic looks a track up by its Apple Music id with the iTunes Lookup
// API (no key needed).
func (c *TrackClient) appleMusic(ctx context.Context, id, country string) (*TrackMatch, error) {
	if country == "" {
		country = "us"
	}
	body, err := c.get(ctx, "https://itunes.apple.com/lookup?entity=song&id="+url.QueryEscape(id)+"&country="+url.QueryEscape(country))
	if err != nil {
		return nil, err
	}
	var data struct {
		Results []struct {
			Kind          string `json:"kind"`
			TrackName     string `json:"trackName"`
			ArtistName    string `json:"artistName"`
			TrackViewURL  string `json:"trackViewUrl"`
			ArtworkURL100 string `json:"artworkUrl100"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, err
	}
	for _, r := range data.Results {
		if r.Kind != "song" || r.TrackName == "" {
			continue
		}
		m := &TrackMatch{Source: TrackSourceApple, ExternalID: id, Title: r.TrackName, Artist: r.ArtistName}
		if r.TrackViewURL != "" {
			viewURL := strings.TrimSuffix(r.TrackViewURL, "&uo=4")
			m.URL = &viewURL
		}
		if r.ArtworkURL100 != "" {
			art := strings.Replace(r.ArtworkURL100, "100x100bb", "300x300bb", 1)
			m.ArtworkURL = &art
		}
		return m, nil
	}
	return nil, ErrTrackNotFound
}

var (
	ogTitlePattern = regexp.MustCompile(`<meta property="og:title" content="([^"]*)"`)
	ogURLPattern   = regexp.MustCompile(`<meta property="og:url" content="([^"]*)"`)
	ogImagePattern = regexp.MustCompile(`<meta property="og:image" content="([^"]*)"`)
)

// shazam reads a Shazam song: its id is the Apple Music id, so the iTunes
// lookup usually has it; otherwise its page's title does ("{track} - {artist}:
// Song Lyrics, …"). Shazam serves a trending song for an id it doesn't know,
// so the page only counts when it's the song asked for.
func (c *TrackClient) shazam(ctx context.Context, link *TrackLink) (*TrackMatch, error) {
	m, err := c.appleMusic(ctx, link.ID, "us")
	if err == nil {
		m.Source, m.URL = TrackSourceShazam, &link.URL
		return m, nil
	}
	if !errors.Is(err, ErrTrackNotFound) {
		return nil, err
	}

	body, err := c.get(ctx, link.URL)
	if err != nil {
		return nil, err
	}
	page := string(body)
	ogURL := ogURLPattern.FindStringSubmatch(page)
	ogTitle := ogTitlePattern.FindStringSubmatch(page)
	if ogURL == nil || ogTitle == nil || !strings.Contains(html.UnescapeString(ogURL[1]), "/song/"+link.ID+"/") {
		return nil, ErrTrackNotFound
	}
	title, _, _ := strings.Cut(html.UnescapeString(ogTitle[1]), ": Song Lyrics")
	track, artist := title, ""
	if i := strings.LastIndex(title, " - "); i > 0 {
		track, artist = title[:i], title[i+3:]
	}
	m = &TrackMatch{Source: TrackSourceShazam, ExternalID: link.ID, URL: &link.URL, Title: track, Artist: artist}
	if img := ogImagePattern.FindStringSubmatch(page); img != nil {
		art := html.UnescapeString(img[1])
		m.ArtworkURL = &art
	}
	return m, nil
}
