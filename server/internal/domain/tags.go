package domain

import (
	"errors"
	"strings"
	"unicode/utf8"
)

const (
	MaxTagLength     = 32
	MaxTagsPerReview = 8
)

// NormalizeTag folds a user-typed tag to its stored form: trimmed, inner
// whitespace collapsed to single spaces, lowercase - so "Older  Crowd " and
// "older crowd" are the same library entry. Returns "" for a blank tag.
func NormalizeTag(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

// NormalizeTags normalizes and dedupes a review's tags (first occurrence
// wins), dropping blanks, and rejects a set that's too large or has a tag
// that's too long.
func NormalizeTags(in []string) ([]string, error) {
	seen := make(map[string]struct{}, len(in))
	out := make([]string, 0, len(in))
	for _, raw := range in {
		t := NormalizeTag(raw)
		if t == "" {
			continue
		}
		if utf8.RuneCountInString(t) > MaxTagLength {
			return nil, errors.New("tags must be at most 32 characters")
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	if len(out) > MaxTagsPerReview {
		return nil, errors.New("at most 8 tags per review")
	}
	return out, nil
}
