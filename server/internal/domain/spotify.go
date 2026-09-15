package domain

import (
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
	ImageURL  *string  `json:"imageUrl"`
	Genres    []string `json:"genres"`
}

type SpotifyClient struct {
	clientID     string
	clientSecret string

	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

func NewSpotifyClient(clientID, clientSecret string) *SpotifyClient {
	return &SpotifyClient{clientID: clientID, clientSecret: clientSecret}
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

	resp, err := http.DefaultClient.Do(req)
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

	resp, err := http.DefaultClient.Do(req)
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
		out = append(out, SpotifyArtist{
			SpotifyID: a.ID,
			Name:      a.Name,
			ImageURL:  imageURL,
			Genres:    a.Genres,
		})
	}
	return out, nil
}
