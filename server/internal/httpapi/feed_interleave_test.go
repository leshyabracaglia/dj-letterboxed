package httpapi

import "testing"

func TestInterleaveFeed_SplicesEveryFourth(t *testing.T) {
	followed := make([]ReviewDTO, 6)
	for i := range followed {
		followed[i].ID = "f" + string(rune('0'+i))
	}
	popular := make([]ReviewDTO, 2)
	for i := range popular {
		popular[i].ID = "p" + string(rune('0'+i))
	}

	out := interleaveFeed(followed, popular)

	// followed[0..3] then popular[0] spliced after the 4th, then followed[4..5].
	wantOrder := []string{"f0", "f1", "f2", "f3", "p0", "f4", "f5"}
	if len(out) != len(wantOrder) {
		t.Fatalf("got %d items, want %d: %+v", len(out), len(wantOrder), out)
	}
	for i, id := range wantOrder {
		if out[i].ID != id {
			t.Fatalf("position %d: got %q, want %q", i, out[i].ID, id)
		}
	}
}

func TestInterleaveFeed_NoPopularItemsLeftToSplice(t *testing.T) {
	followed := make([]ReviewDTO, 4)
	for i := range followed {
		followed[i].ID = "f" + string(rune('0'+i))
	}

	out := interleaveFeed(followed, nil)
	if len(out) != 4 {
		t.Fatalf("expected 4 items with no popular pool, got %d", len(out))
	}
}
