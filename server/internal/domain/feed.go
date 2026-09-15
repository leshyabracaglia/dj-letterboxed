package domain

import (
	"encoding/json"
	"time"
)

const PopularInterleaveEvery = 4

// Cursor mirrors feed.ts's cursor shape: a JSON string encoding both the
// followed-items pagination cursor and a running offset into the
// separately-ranked popular pool. Decoding is defensive by design — an
// unparseable cursor falls back to the zero value rather than erroring.
type Cursor struct {
	CreatedAt     *time.Time `json:"createdAt"`
	PopularOffset int        `json:"popularOffset"`
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
