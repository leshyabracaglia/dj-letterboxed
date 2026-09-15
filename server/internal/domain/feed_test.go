package domain

import "testing"

func TestDecodeCursor_Empty(t *testing.T) {
	c := DecodeCursor("")
	if c.CreatedAt != nil || c.PopularOffset != 0 {
		t.Fatalf("expected zero cursor, got %+v", c)
	}
}

func TestDecodeCursor_Malformed(t *testing.T) {
	c := DecodeCursor("{not json")
	if c.CreatedAt != nil || c.PopularOffset != 0 {
		t.Fatalf("expected defensive fallback to zero cursor, got %+v", c)
	}
}

func TestEncodeDecodeCursor_RoundTrip(t *testing.T) {
	enc := EncodeCursor(Cursor{PopularOffset: 7})
	dec := DecodeCursor(enc)
	if dec.PopularOffset != 7 {
		t.Fatalf("round-trip mismatch: got popularOffset=%d", dec.PopularOffset)
	}
}
