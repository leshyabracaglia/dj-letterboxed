package domain

import "testing"

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Nova Reyes":        "nova-reyes",
		"  Deep   Current ": "deep-current",
		"Static_Bloom!!":    "static-bloom",
		"---leading":        "leading",
	}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}
