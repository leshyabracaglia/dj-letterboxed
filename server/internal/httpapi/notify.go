package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"beatboxd/server/internal/db"
	"beatboxd/server/internal/db/queries"
	"beatboxd/server/internal/domain"
)

// Notifications of social activity on a user's account: each is recorded
// for the in-app list (GET /api/notifications) and pushed to the user's
// devices. That happens after the request's own work has succeeded, in the
// background on a fresh context (the request's is cancelled once the
// response goes out), and any failure is only logged: a missed notification
// shouldn't fail a like. Only a newly recorded notification pushes, so a
// repeat follow, like or tag (see queries.CreateNotification) stays quiet.
//
// The data payload says what happened, not where to go; the app maps it
// to a route (lib/push.ts), so in-app paths stay defined in one place.

const notifyTimeout = 15 * time.Second

func (h *Handlers) notifyFollow(actor *db.User, targetID string) {
	h.notifyAsync(func(ctx context.Context) error {
		return h.recordAndPush(ctx, queries.CreateNotificationParams{
			UserID: targetID, ActorID: actor.ID, Type: "follow",
		}, displayName(actor)+" started following you", map[string]string{
			"type": "follow", "username": actor.Username,
		})
	})
}

func (h *Handlers) notifyLike(actor *db.User, reviewID string) {
	h.notifyAsync(func(ctx context.Context) error {
		info, err := queries.GetReviewNotifyInfo(ctx, h.Pool, reviewID)
		if err != nil {
			return err
		}
		return h.recordAndPush(ctx, queries.CreateNotificationParams{
			UserID: info.OwnerID, ActorID: actor.ID, Type: "like", ReviewID: &reviewID,
		}, displayName(actor)+" liked your review"+ofSubject(info.Subject), map[string]string{
			"type": "like", "reviewId": reviewID,
		})
	})
}

func (h *Handlers) notifyComment(actor *db.User, comment *db.ReviewComment) {
	h.notifyAsync(func(ctx context.Context) error {
		info, err := queries.GetReviewNotifyInfo(ctx, h.Pool, comment.ReviewID)
		if err != nil {
			return err
		}
		text := displayName(actor) + " commented on your review" + ofSubject(info.Subject) + ": " + truncate(comment.Body, 120)
		return h.recordAndPush(ctx, queries.CreateNotificationParams{
			UserID: info.OwnerID, ActorID: actor.ID, Type: "comment", ReviewID: &comment.ReviewID, CommentID: &comment.ID,
		}, text, map[string]string{
			"type": "comment", "reviewId": comment.ReviewID,
		})
	})
}

// notifyTagged tells each of userIDs that actor tagged them as being at the
// night out reviewID belongs to. Anyone already notified of it is skipped,
// so re-saving who was there only reaches the newly tagged.
func (h *Handlers) notifyTagged(actor *db.User, reviewID string, userIDs []string) {
	if len(userIDs) == 0 {
		return
	}
	h.notifyAsync(func(ctx context.Context) error {
		info, err := queries.GetReviewNotifyInfo(ctx, h.Pool, reviewID)
		if err != nil {
			return err
		}
		text := displayName(actor) + " tagged you in their night out"
		if info.Subject != "" {
			text = displayName(actor) + " tagged you at " + info.Subject
		}
		var errs []error
		for _, uid := range userIDs {
			errs = append(errs, h.recordAndPush(ctx, queries.CreateNotificationParams{
				UserID: uid, ActorID: actor.ID, Type: "tag", ReviewID: &reviewID,
			}, text, map[string]string{
				"type": "tag", "reviewId": reviewID,
			}))
		}
		return errors.Join(errs...)
	})
}

// notifyTrackID tells userID about an ID request on reviewID: that actor
// suggested what an unidentified track on their night was ("id_suggested",
// with the title), or accepted the one they suggested ("id_accepted").
func (h *Handlers) notifyTrackID(actor *db.User, userID, reviewID, kind, title string) {
	h.notifyAsync(func(ctx context.Context) error {
		info, err := queries.GetReviewNotifyInfo(ctx, h.Pool, reviewID)
		if err != nil {
			return err
		}
		text := displayName(actor) + " thinks the ID on your night" + ofSubject(info.Subject) + " is " + truncate(title, 80)
		if kind == "id_accepted" {
			text = displayName(actor) + " says you got the ID" + ofSubject(info.Subject) + " right"
		}
		return h.recordAndPush(ctx, queries.CreateNotificationParams{
			UserID: userID, ActorID: actor.ID, Type: kind, ReviewID: &reviewID,
		}, text, map[string]string{
			"type": kind, "reviewId": reviewID,
		})
	})
}

// notifyAlsoThere tells actor's friends who already logged the night out
// reviewID that actor was there too (each only once per night).
func (h *Handlers) notifyAlsoThere(actor *db.User, reviewID string) {
	h.notifyAsync(func(ctx context.Context) error {
		friends, err := queries.GetAlsoThereByReviewIDs(ctx, h.Pool, []string{reviewID}, nil)
		if err != nil || len(friends[reviewID]) == 0 {
			return err
		}
		info, err := queries.GetReviewNotifyInfo(ctx, h.Pool, reviewID)
		if err != nil {
			return err
		}
		text := displayName(actor) + " was there too"
		if info.Subject != "" {
			text = displayName(actor) + " was at " + info.Subject + " too"
		}
		var errs []error
		for _, friend := range friends[reviewID] {
			errs = append(errs, h.recordAndPush(ctx, queries.CreateNotificationParams{
				UserID: friend.ID, ActorID: actor.ID, Type: "also_there", ReviewID: &reviewID,
			}, text, map[string]string{
				"type": "also_there", "reviewId": reviewID,
			}))
		}
		return errors.Join(errs...)
	})
}

// notifyHereToo pushes to each of friends that actor just checked in at the
// venue they're at. It's a push only, not kept in the notifications list.
func (h *Handlers) notifyHereToo(actor *db.User, venueName string, friends []db.User) {
	if len(friends) == 0 {
		return
	}
	h.notifyAsync(func(ctx context.Context) error {
		var errs []error
		for _, friend := range friends {
			errs = append(errs, h.sendToUser(ctx, friend.ID, displayName(actor)+" just checked in at "+venueName+" too", map[string]string{
				"type": "here_too", "username": actor.Username,
			}))
		}
		return errors.Join(errs...)
	})
}

func (h *Handlers) notifyAsync(send func(ctx context.Context) error) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), notifyTimeout)
		defer cancel()
		if err := send(ctx); err != nil {
			slog.Warn("notification failed", "error", err)
		}
	}()
}

// recordAndPush records p and, if it's new, pushes body to the recipient.
func (h *Handlers) recordAndPush(ctx context.Context, p queries.CreateNotificationParams, body string, data map[string]string) error {
	isNew, err := queries.CreateNotification(ctx, h.Pool, p)
	if err != nil || !isNew {
		return err
	}
	return h.sendToUser(ctx, p.UserID, body, data)
}

// sendToUser pushes body to every device userID is signed in on, and
// forgets any token Expo says is dead. A no-op when push isn't configured.
func (h *Handlers) sendToUser(ctx context.Context, userID, body string, data map[string]string) error {
	if h.Push == nil {
		return nil
	}
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
