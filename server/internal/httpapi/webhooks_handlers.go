package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	svix "github.com/svix/svix-webhooks/go"

	"beatboxd/server/internal/db/queries"
)

type clerkUserEvent struct {
	Type string `json:"type"`
	Data struct {
		ID        string  `json:"id"`
		Username  *string `json:"username"`
		FirstName *string `json:"first_name"`
		LastName  *string `json:"last_name"`
		ImageURL  *string `json:"image_url"`
	} `json:"data"`
}

// ClerkWebhook ports api/webhooks/clerk.ts: svix-verified sync of Clerk
// user.created/updated/deleted events into the local users table. This is
// the primary sync path; RequireAuth's lazy-create is only a
// race-condition fallback for requests that beat the webhook.
func (h *Handlers) ClerkWebhook(webhookSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if webhookSecret == "" {
			http.Error(w, "Webhook secret not configured", http.StatusInternalServerError)
			return
		}

		payload, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}

		wh, err := svix.NewWebhook(webhookSecret)
		if err != nil {
			InternalError(w, err)
			return
		}
		if err := wh.Verify(payload, r.Header); err != nil {
			http.Error(w, "Invalid signature", http.StatusBadRequest)
			return
		}

		var event clerkUserEvent
		if err := json.Unmarshal(payload, &event); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}

		clerkID := event.Data.ID

		if event.Type == "user.deleted" {
			if err := queries.DeleteUserByClerkID(r.Context(), h.Pool, clerkID); err != nil {
				InternalError(w, err)
				return
			}
			w.Write([]byte("ok"))
			return
		}

		username := clerkID[max(0, len(clerkID)-8):]
		username = "user_" + username
		if event.Data.Username != nil && *event.Data.Username != "" {
			username = *event.Data.Username
		}

		var nameParts []string
		if event.Data.FirstName != nil && *event.Data.FirstName != "" {
			nameParts = append(nameParts, *event.Data.FirstName)
		}
		if event.Data.LastName != nil && *event.Data.LastName != "" {
			nameParts = append(nameParts, *event.Data.LastName)
		}
		var displayName *string
		if len(nameParts) > 0 {
			joined := strings.Join(nameParts, " ")
			displayName = &joined
		}

		if _, err := queries.UpsertUserFromClerk(r.Context(), h.Pool, clerkID, username, displayName, event.Data.ImageURL); err != nil {
			InternalError(w, err)
			return
		}

		w.Write([]byte("ok"))
	}
}
