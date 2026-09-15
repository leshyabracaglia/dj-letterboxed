package domain

import (
	"regexp"
	"strings"
)

var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

// Slugify mirrors the TS helper in lib/server/routers/djs.ts: lowercase,
// strip non-alphanumeric runs to a single hyphen, trim leading/trailing
// hyphens.
func Slugify(name string) string {
	s := strings.ToLower(name)
	s = nonAlnum.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
