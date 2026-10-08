package httpapi

import (
	"context"
	"log/slog"
	"time"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// Push notifications for social activity on a user's account. They're sent
// after the request's own work has succeeded, in the background on a fresh
// context (the request's is cancelled once the response goes out), and any
// failure is only logged: a missed notification shouldn't fail a like.
//
// The data payload says what happened, not where to go; the app maps it
// to a route (lib/push.ts), so in-app paths stay defined in one place.

const notifyTimeout = 15 * time.Second

func (h *Handlers) notifyFollow(actor *db.User, targetID string) {
	h.notifyAsync(func(ctx context.Context) error {
		return h.sendToUser(ctx, targetID, displayName(actor)+" started following you", map[string]string{
			"type": "follow", "username": actor.Username,
		})
	})
}

func (h *Handlers) notifyLike(actor *db.User, reviewID string) {
	h.notifyAsync(func(ctx context.Context) error {
		info, err := queries.GetReviewNotifyInfo(ctx, h.Pool, reviewID)
		if err != nil || info.OwnerID == actor.ID {
			return err
		}
		return h.sendToUser(ctx, info.OwnerID, displayName(actor)+" liked your review"+ofSubject(info.Subject), map[string]string{
			"type": "like", "reviewId": reviewID,
		})
	})
}

func (h *Handlers) notifyComment(actor *db.User, reviewID, body string) {
	h.notifyAsync(func(ctx context.Context) error {
		info, err := queries.GetReviewNotifyInfo(ctx, h.Pool, reviewID)
		if err != nil || info.OwnerID == actor.ID {
			return err
		}
		text := displayName(actor) + " commented on your review" + ofSubject(info.Subject) + ": " + truncate(body, 120)
		return h.sendToUser(ctx, info.OwnerID, text, map[string]string{
			"type": "comment", "reviewId": reviewID,
		})
	})
}

func (h *Handlers) notifyAsync(send func(ctx context.Context) error) {
	if h.Push == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
		defer cancel()
		if err := send(ctx); err != nil {
			slog.Warn("push notification failed", "error", err)
		}
	}()
}

// sendToUser pushes body to every device userID is signed in on, and
// forgets any token Expo says is dead.
func (h *Handlers) sendToUser(ctx context.Context, userID, body string, data map[string]string) error {
	tokens, err := queries.ListPushTokens(ctx, h.Pool, userID)
	if err != nil || len(tokens) == 0 {
		return err
	}
	messages := make([]domain.PushMessage, len(tokens))
	for i, t := range tokens {
		messages[i] = domain.PushMessage{To: t, Body: body, Data: data, Sound: "default"}
	}
	dead, sendErr := h.Push.Send(ctx, messages)
	if err := queries.DeletePushTokens(ctx, h.Pool, dead); err != nil {
		slog.Warn("dropping dead push tokens failed", "error", err)
	}
	return sendErr
}

func displayName(u *db.User) string {
	if u.DisplayName != nil && *u.DisplayName != "" {
		return *u.DisplayName
	}
	return u.Username
}

func ofSubject(subject string) string {
	if subject == "" {
		return ""
	}
	return " of " + subject
}

// truncate shortens s to at most n runes, with an ellipsis if cut.
func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
