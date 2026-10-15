package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Plain-text email through Resend (resend.com), for alerts to the app's
// owner (content reports). Resend's shared onboarding@resend.dev sender can
// mail the Resend account's own address with no domain set up.

type EmailClient struct {
	apiKey string
	from   string
	to     string
	http   *http.Client
}

// NewEmailClient returns nil unless apiKey and to are both set.
func NewEmailClient(apiKey, from, to string) *EmailClient {
	if apiKey == "" || to == "" {
		return nil
	}
	if from == "" {
		from = "Beatboxd <onboarding@resend.dev>"
	}
	return &EmailClient{apiKey: apiKey, from: from, to: to, http: &http.Client{Timeout: 10 * time.Second}}
}

func (c *EmailClient) Send(ctx context.Context, subject, text string) error {
	body, err := json.Marshal(map[string]any{
		"from": c.from, "to": []string{c.to}, "subject": subject, "text": text,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend send failed: %d", resp.StatusCode)
	}
	return nil
}
