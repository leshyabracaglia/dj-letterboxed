package domain

import (
	"testing"
	"time"
)

func TestDecodeCursor_Empty(t *testing.T) {
	c := DecodeCursor("")
	if c.CreatedAt != nil {
		t.Fatalf("expected zero cursor, got %+v", c)
	}
}

func TestDecodeCursor_Malformed(t *testing.T) {
	c := DecodeCursor("{not json")
	if c.CreatedAt != nil {
		t.Fatalf("expected defensive fallback to zero cursor, got %+v", c)
	}
}

func TestEncodeDecodeCursor_RoundTrip(t *testing.T) {
	at := time.Date(2026, 10, 14, 22, 30, 0, 0, time.UTC)
	dec := DecodeCursor(EncodeCursor(Cursor{CreatedAt: &at}))
	if dec.CreatedAt == nil || !dec.CreatedAt.Equal(at) {
		t.Fatalf("round-trip mismatch: got createdAt=%v", dec.CreatedAt)
	}
}
