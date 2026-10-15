package domain

import (
	"encoding/json"
	"time"
)

// Cursor is the following feed's pagination cursor: the createdAt of the
// last item seen, as an opaque JSON string. Decoding is defensive by design -
// an unparseable cursor falls back to the zero value (the first page) rather
// than erroring.
type Cursor struct {
	CreatedAt *time.Time `json:"createdAt"`
}

func EncodeCursor(c Cursor) string {
	b, err := json.Marshal(c)
	if err != nil {
		return ""
	}
	return string(b)
}

func DecodeCursor(s string) Cursor {
	if s == "" {
		return Cursor{}
	}
	var c Cursor
	if err := json.Unmarshal([]byte(s), &c); err != nil {
		return Cursor{}
	}
	return c
}
