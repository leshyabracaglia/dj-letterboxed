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
	// Optional: without it place search returns 503 and venues can only be
	// typed in by hand.
	GooglePlacesAPIKey string
	// Optional: only needed if the Expo project has enhanced push security
	// turned on. Push notifications send without it otherwise.
	ExpoAccessToken string
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
		GooglePlacesAPIKey:        os.Getenv("GOOGLE_PLACES_API_KEY"),
		ExpoAccessToken:           os.Getenv("EXPO_ACCESS_TOKEN"),
	}
	// Terraform stores "unset" when no key was given (Secrets Manager
	// rejects empty strings); treat it as not configured.
	if cfg.GooglePlacesAPIKey == "unset" {
		cfg.GooglePlacesAPIKey = ""
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
