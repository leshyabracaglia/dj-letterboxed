package domain

import (
	"errors"
	"testing"
)

func TestParseTrackLink(t *testing.T) {
	cases := []struct {
		name, raw           string
		source, id, country string
		url                 string
	}{
		{
			name: "spotify", raw: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc",
			source: TrackSourceSpotify, id: "4uLU6hMCjMI75M1A2tKUQC", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
		},
		{
			name: "spotify, localized", raw: "https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC",
			source: TrackSourceSpotify, id: "4uLU6hMCjMI75M1A2tKUQC", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
		},
		{
			name: "soundcloud, query and www dropped", raw: "https://www.soundcloud.com/forss/flickermood?utm_source=x",
			source: TrackSourceSoundCloud, id: "forss/flickermood", url: "https://soundcloud.com/forss/flickermood",
		},
		{
			name: "soundcloud short link", raw: "https://on.soundcloud.com/Z8wAc",
			source: TrackSourceSoundCloud, url: "https://on.soundcloud.com/Z8wAc",
		},
		{
			name: "apple music album link", raw: "https://music.apple.com/gb/album/dtmf/1787022393?i=1787023936",
			source: TrackSourceApple, id: "1787023936", country: "gb", url: "https://music.apple.com/gb/song/1787023936",
		},
		{
			name: "apple music song link", raw: "https://music.apple.com/us/song/dtmf/1787023936",
			source: TrackSourceApple, id: "1787023936", country: "us", url: "https://music.apple.com/us/song/1787023936",
		},
		{
			name: "shazam", raw: "https://www.shazam.com/song/1787023936/dtmf",
			source: TrackSourceShazam, id: "1787023936", url: "https://www.shazam.com/song/1787023936",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			link, err := ParseTrackLink(tc.raw)
			if err != nil {
				t.Fatalf("ParseTrackLink: %v", err)
			}
			if link.Source != tc.source || link.ID != tc.id || link.Country != tc.country || link.URL != tc.url {
				t.Fatalf("got %+v", link)
			}
		})
	}

	unsupported := []string{
		"not a link",
		"ftp://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
		"https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC",
		"https://soundcloud.com/forss/sets/soulhack",
		"https://soundcloud.com/forss",
		"https://music.apple.com/us/album/dtmf/1787022393",
		"https://www.shazam.com/track/473150442/movin-to-the-sun",
		// Look-alike hosts aren't the service.
		"https://open.spotify.com.evil.example/track/4uLU6hMCjMI75M1A2tKUQC",
		"https://evil.example/soundcloud.com/forss/flickermood",
		"http://169.254.169.254/latest/meta-data",
	}
	for _, raw := range unsupported {
		if _, err := ParseTrackLink(raw); !errors.Is(err, ErrUnsupportedLink) {
			t.Errorf("ParseTrackLink(%q) = %v, want ErrUnsupportedLink", raw, err)
		}
	}
}

// TestIsTrackArtworkURL: a track shows cover art only from the services
// tracks come from, over https, so a typed-in URL can't be a tracking pixel.
func TestIsTrackArtworkURL(t *testing.T) {
	for raw, want := range map[string]bool{
		"https://i.scdn.co/image/ab67616d0000b273":                        true,
		"https://i1.sndcdn.com/artworks-000067273316-smsiqx-t500x500.jpg": true,
		"https://is1-ssl.mzstatic.com/image/thumb/Music/300x300bb.jpg":    true,
		"http://i.scdn.co/image/ab67616d0000b273":                         false,
		"https://tracker.example/pixel.gif":                               false,
		"https://i.scdn.co.evil.example/image.jpg":                        false,
		"https://evil.example/sndcdn.com/image.jpg":                       false,
		"not a url": false,
	} {
		if got := IsTrackArtworkURL(raw); got != want {
			t.Errorf("IsTrackArtworkURL(%q) = %v, want %v", raw, got, want)
		}
	}
}
