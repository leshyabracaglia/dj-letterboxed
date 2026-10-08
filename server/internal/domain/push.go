package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Expo's push service, which fans out to APNs/FCM for the Expo push tokens
// the app registers. Sending needs no credentials unless the Expo project
// has "enhanced push security" turned on, in which case accessToken is set.

type PushMessage struct {
	To    string `json:"to"`
	Title string `json:"title,omitempty"`
	Body  string `json:"body"`
	// Data reaches the app with the notification; "url" is the in-app
	// route a tap opens.
	Data  map[string]string `json:"data,omitempty"`
	Sound string            `json:"sound,omitempty"`
}

type PushClient struct {
	accessToken string
	url         string
	http        *http.Client
}

func NewPushClient(accessToken string) *PushClient {
	return &PushClient{
		accessToken: accessToken,
		url:         "https://exp.host/--/api/v2/push/send",
		http:        &http.Client{Timeout: 10 * time.Second},
	}
}

// Expo takes up to 100 messages per request.
const maxPushBatch = 100

// Send delivers messages and returns the tokens Expo says are no longer
// registered (app uninstalled, notifications revoked), for the caller to
// forget. Other per-message failures are dropped: a notification is best
// effort.
func (c *PushClient) Send(ctx context.Context, messages []PushMessage) (deadTokens []string, err error) {
	for start := 0; start < len(messages); start += maxPushBatch {
		batch := messages[start:min(start+maxPushBatch, len(messages))]
		dead, err := c.sendBatch(ctx, batch)
		deadTokens = append(deadTokens, dead...)
		if err != nil {
			return deadTokens, err
		}
	}
	return deadTokens, nil
}

func (c *PushClient) sendBatch(ctx context.Context, batch []PushMessage) ([]string, error) {
	body, err := json.Marshal(batch)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.accessToken)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("expo push: status %d", res.StatusCode)
	}

	// One ticket per message, in order.
	var out struct {
		Data []struct {
			Status  string `json:"status"`
			Details struct {
				Error string `json:"error"`
			} `json:"details"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("expo push: decode response: %w", err)
	}
	var dead []string
	for i, ticket := range out.Data {
		if i < len(batch) && ticket.Status == "error" && ticket.Details.Error == "DeviceNotRegistered" {
			dead = append(dead, batch[i].To)
		}
	}
	return dead, nil
}
