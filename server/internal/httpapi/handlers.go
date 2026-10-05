package httpapi

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"beatboxd/server/internal/domain"
)

type Handlers struct {
	Pool    *pgxpool.Pool
	Spotify *domain.SpotifyClient
	Places  *domain.PlacesClient
}

func NewHandlers(pool *pgxpool.Pool, spotify *domain.SpotifyClient, places *domain.PlacesClient) *Handlers {
	return &Handlers{Pool: pool, Spotify: spotify, Places: places}
}
