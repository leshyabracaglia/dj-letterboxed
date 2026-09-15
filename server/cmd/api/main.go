package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"beatboxd/server/internal/auth"
	"beatboxd/server/internal/config"
	"beatboxd/server/internal/db"
	"beatboxd/server/internal/domain"
	"beatboxd/server/internal/httpapi"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	verifier, err := auth.NewVerifier(ctx, cfg.ClerkJWKSURL, cfg.ClerkIssuer)
	if err != nil {
		return err
	}

	spotify := domain.NewSpotifyClient(cfg.SpotifyClientID, cfg.SpotifyClientSecret)

	router := httpapi.NewRouter(httpapi.RouterConfig{
		Pool:                      pool,
		Verifier:                  verifier,
		Spotify:                   spotify,
		ClerkWebhookSigningSecret: cfg.ClerkWebhookSigningSecret,
	})

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
