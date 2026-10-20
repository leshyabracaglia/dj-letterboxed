package domain

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type SpotifyArtist struct {
	SpotifyID string   `json:"spotifyId"`
	Name      string   `json:"name"`
	ImageURL  *string  `json:"imageUrl" extensions:"x-nullable"`
	Genres    []string `json:"genres"`
}

type SpotifyClient struct {
	clientID     string
	clientSecret string
	http         *http.Client

	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

func NewSpotifyClient(clientID, clientSecret string) *SpotifyClient {
	return &SpotifyClient{clientID: clientID, clientSecret: clientSecret, http: &http.Client{Timeout: 8 * time.Second}}
}

func (c *SpotifyClient) getAccessToken() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.token != "" && c.expiresAt.After(time.Now()) {
		return c.token, nil
	}

	if c.clientID == "" || c.clientSecret == "" {
		return "", fmt.Errorf("spotify credentials are not configured")
	}

	req, err := http.NewRequest(http.MethodPost, "https://accounts.spotify.com/api/token",
		strings.NewReader("grant_type=client_credentials"))
	if err != nil {
		return "", err
	}
	auth := base64.StdEncoding.EncodeToString([]byte(c.clientID + ":" + c.clientSecret))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("spotify token request failed: %d", resp.StatusCode)
	}

	var data struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	c.token = data.AccessToken
	// Refresh a little early so we don't race a mid-request expiry.
	c.expiresAt = time.Now().Add(time.Duration(data.ExpiresIn-60) * time.Second)
	return c.token, nil
}

func (c *SpotifyClient) SearchArtists(query string) ([]SpotifyArtist, error) {
	token, err := c.getAccessToken()
	if err != nil {
		return nil, err
	}

	u := "https://api.spotify.com/v1/search?type=artist&limit=10&q=" + url.QueryEscape(query)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("spotify search failed: %d", resp.StatusCode)
	}

	var data struct {
		Artists struct {
			Items []struct {
				ID     string `json:"id"`
				Name   string `json:"name"`
				Images []struct {
					URL string `json:"url"`
				} `json:"images"`
				Genres []string `json:"genres"`
			} `json:"items"`
		} `json:"artists"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	out := make([]SpotifyArtist, 0, len(data.Artists.Items))
	for _, a := range data.Artists.Items {
		var imageURL *string
		if len(a.Images) > 0 {
			imageURL = &a.Images[0].URL
		}
		// Spotify omits genres entirely for newer dev-mode apps; keep this a
		// JSON [] rather than null since the client reads .length on it.
		genres := a.Genres
		if genres == nil {
			genres = []string{}
		}
		out = append(out, SpotifyArtist{
			SpotifyID: a.ID,
			Name:      a.Name,
			ImageURL:  imageURL,
			Genres:    genres,
		})
	}
	return out, nil
}

// spotifyTrack is a track as Spotify's API returns it.
type spotifyTrack struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Artists []struct {
		Name string `json:"name"`
	} `json:"artists"`
	Album struct {
		Images []struct {
			URL string `json:"url"`
		} `json:"images"`
	} `json:"album"`
	ExternalURLs struct {
		Spotify string `json:"spotify"`
	} `json:"external_urls"`
}

func (t spotifyTrack) match() TrackMatch {
	names := make([]string, len(t.Artists))
	for i, a := range t.Artists {
		names[i] = a.Name
	}
	m := TrackMatch{Source: TrackSourceSpotify, ExternalID: t.ID, Title: t.Name, Artist: strings.Join(names, ", ")}
	if t.ExternalURLs.Spotify != "" {
		m.URL = &t.ExternalURLs.Spotify
	}
	// The first album image is the largest; the second (~300px) is plenty.
	if n := len(t.Album.Images); n > 0 {
		m.ArtworkURL = &t.Album.Images[min(1, n-1)].URL
	}
	return m
}

// getJSON GETs a Spotify Web API path and decodes the response into out.
func (c *SpotifyClient) getJSON(ctx context.Context, path string, out any) error {
	token, err := c.getAccessToken()
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.spotify.com/v1"+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusBadRequest {
		return ErrTrackNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("spotify %s failed: %d", path, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// SearchTracks finds up to 10 tracks matching query.
func (c *SpotifyClient) SearchTracks(ctx context.Context, query string) ([]TrackMatch, error) {
	var data struct {
		Tracks struct {
			Items []spotifyTrack `json:"items"`
		} `json:"tracks"`
	}
	if err := c.getJSON(ctx, "/search?type=track&limit=10&q="+url.QueryEscape(query), &data); err != nil {
		return nil, err
	}
	out := make([]TrackMatch, len(data.Tracks.Items))
	for i, t := range data.Tracks.Items {
		out[i] = t.match()
	}
	return out, nil
}

// GetTrack looks up one track by its Spotify id.
func (c *SpotifyClient) GetTrack(ctx context.Context, id string) (*TrackMatch, error) {
	var t spotifyTrack
	if err := c.getJSON(ctx, "/tracks/"+url.PathEscape(id), &t); err != nil {
		return nil, err
	}
	m := t.match()
	return &m, nil
}
