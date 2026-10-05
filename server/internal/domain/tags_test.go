package domain

import (
	"reflect"
	"strings"
	"testing"
)

func TestNormalizeTag(t *testing.T) {
	cases := map[string]string{
		"older crowd":      "older crowd",
		"  Older   Crowd ": "older crowd",
		"DRUNK\tcrowd":     "drunk crowd",
		"   ":              "",
		"Überwältigend":    "überwältigend",
	}
	for in, want := range cases {
		if got := NormalizeTag(in); got != want {
			t.Errorf("NormalizeTag(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormalizeTags(t *testing.T) {
	got, err := NormalizeTags([]string{"Relaxed", " relaxed", "", "Packed"})
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"relaxed", "packed"}; !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}

	if _, err := NormalizeTags([]string{strings.Repeat("a", MaxTagLength+1)}); err == nil {
		t.Error("expected error for an over-long tag")
	}
	// Exactly the limit, counted in characters rather than bytes.
	if _, err := NormalizeTags([]string{strings.Repeat("é", MaxTagLength)}); err != nil {
		t.Errorf("unexpected error at the length limit: %v", err)
	}

	tooMany := make([]string, MaxTagsPerReview+1)
	for i := range tooMany {
		tooMany[i] = strings.Repeat("x", i+1)
	}
	if _, err := NormalizeTags(tooMany); err == nil {
		t.Error("expected error for too many tags")
	}
}
