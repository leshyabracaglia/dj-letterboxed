package httpapi

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"beatboxd/server/internal/domain"
)

type Handlers struct {
	Pool    *pgxpool.Pool
	Spotify *domain.SpotifyClient
}

func NewHandlers(pool *pgxpool.Pool, spotify *domain.SpotifyClient) *Handlers {
	return &Handlers{Pool: pool, Spotify: spotify}
}
