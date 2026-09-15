package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port                      string
	DatabaseURL               string
	ClerkSecretKey            string
	ClerkWebhookSigningSecret string
	ClerkJWKSURL              string
	ClerkIssuer               string
	SpotifyClientID           string
	SpotifyClientSecret       string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:                      getEnv("PORT", "8080"),
		DatabaseURL:               os.Getenv("DATABASE_URL"),
		ClerkSecretKey:            os.Getenv("CLERK_SECRET_KEY"),
		ClerkWebhookSigningSecret: os.Getenv("CLERK_WEBHOOK_SIGNING_SECRET"),
		ClerkJWKSURL:              os.Getenv("CLERK_JWKS_URL"),
		ClerkIssuer:               os.Getenv("CLERK_ISSUER"),
		SpotifyClientID:           os.Getenv("SPOTIFY_CLIENT_ID"),
		SpotifyClientSecret:       os.Getenv("SPOTIFY_CLIENT_SECRET"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("missing DATABASE_URL")
	}
	if cfg.ClerkJWKSURL == "" {
		return nil, fmt.Errorf("missing CLERK_JWKS_URL")
	}
	if cfg.ClerkIssuer == "" {
		return nil, fmt.Errorf("missing CLERK_ISSUER")
	}
	if cfg.ClerkWebhookSigningSecret == "" {
		return nil, fmt.Errorf("missing CLERK_WEBHOOK_SIGNING_SECRET")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
