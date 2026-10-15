package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// A re-engagement push: someone who hasn't opened the app in reengageAway
// gets told when people they follow log nights, at most once per
// reengageAway. "Opened the app" is any signed-in request (see Auth.touch).
// Unlike the notifications in notify.go it isn't recorded in the in-app
// list; tapping it opens the feed.

const (
	reengageAway  = 48 * time.Hour
	reengageEvery = 30 * time.Minute
)

// RunReengagement sends re-engagement pushes every reengageEvery until ctx
// is done.
func RunReengagement(ctx context.Context, pool *pgxpool.Pool, push *domain.PushClient) {
	h := &Handlers{Pool: pool, Push: push}
	ticker := time.NewTicker(reengageEvery)
	defer ticker.Stop()
	for {
		if err := h.sendReengagement(ctx); err != nil {
			slog.Warn("re-engagement run failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (h *Handlers) sendReengagement(ctx context.Context) error {
	candidates, err := queries.ListReengageCandidates(ctx, h.Pool, reengageAway)
	if err != nil {
		return err
	}
	for _, c := range candidates {
		claimed, err := queries.ClaimReengage(ctx, h.Pool, c.UserID, reengageAway)
		if err != nil {
			return err
		}
		if !claimed {
			continue
		}
		sendCtx, cancel := context.WithTimeout(ctx, notifyTimeout)
		err = h.sendToUser(sendCtx, c.UserID, reengageText(c), map[string]string{"type": "following_logs"})
		cancel()
		if err != nil {
			slog.Warn("re-engagement push failed", "user", c.UserID, "error", err)
		}
	}
	return nil
}

func reengageText(c queries.ReengageCandidate) string {
	name := c.Username
	if c.DisplayName != nil && *c.DisplayName != "" {
		name = *c.DisplayName
	}
	text := name + " logged a night out"
	if c.Subject != "" {
		text = name + " logged " + c.Subject
	}
	switch others := c.Count - 1; {
	case others == 1:
		text += ", plus 1 more person you follow"
	case others > 1:
		text += fmt.Sprintf(", plus %d more people you follow", others)
	}
	return text
}
