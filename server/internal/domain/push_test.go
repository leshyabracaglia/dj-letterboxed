package domain

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPushSendReportsDeadTokens(t *testing.T) {
	var got []PushMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		w.Write([]byte(`{"data":[
			{"status":"ok","id":"a"},
			{"status":"error","message":"gone","details":{"error":"DeviceNotRegistered"}},
			{"status":"error","message":"too big","details":{"error":"MessageTooBig"}}
		]}`))
	}))
	defer srv.Close()

	c := NewPushClient("")
	c.url = srv.URL
	dead, err := c.Send(context.Background(), []PushMessage{
		{To: "ExponentPushToken[live]", Body: "hi"},
		{To: "ExponentPushToken[dead]", Body: "hi"},
		{To: "ExponentPushToken[big]", Body: "hi"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("sent %d messages, want 3", len(got))
	}
	if len(dead) != 1 || dead[0] != "ExponentPushToken[dead]" {
		t.Fatalf("dead = %v, want only the DeviceNotRegistered token", dead)
	}
}
