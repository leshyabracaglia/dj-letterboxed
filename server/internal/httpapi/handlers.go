package httpapi

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"beatboxd/server/internal/domain"
)

type Handlers struct {
	Pool    *pgxpool.Pool
	Spotify *domain.SpotifyClient
	Places  *domain.PlacesClient
	Push    *domain.PushClient
	RA      *domain.RAClient
	// Nil when report emails aren't configured.
	Email  *domain.EmailClient
	WebURL string
}

func NewHandlers(pool *pgxpool.Pool, spotify *domain.SpotifyClient, places *domain.PlacesClient, push *domain.PushClient, ra *domain.RAClient, email *domain.EmailClient, webURL string) *Handlers {
	return &Handlers{Pool: pool, Spotify: spotify, Places: places, Push: push, RA: ra, Email: email, WebURL: webURL}
}
