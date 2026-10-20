package domain

import "testing"

func TestIsObjectionable(t *testing.T) {
	blocked := []string{
		"what a NIGGER",
		"bunch of f.a.g.g.o.t.s",
		"n i g g e r",
		"n1gger",
		"nigggger",
		"xxniggerxx",
		"big_nigga99",
		"$pics everywhere",
		"you should kill yourself",
		"KYS",
		"sieg heil",
		"crew 1488",
		"jailbait",
	}
	for _, s := range blocked {
		if !IsObjectionable(s) {
			t.Errorf("IsObjectionable(%q) = false, want true", s)
		}
	}

	allowed := []string{
		"",
		"Fucking incredible set, the bass was shit hot",
		"he sniggered at the drop",
		"Niger and Nigeria",
		"the DJ est arrivé en retard",
		"qué pedo, what a night",
		"Loli played b2b with Spock",
		"Scunthorpe warehouse rave",
		"killer set, killed it",
		"spice girls edit",
		"raccoon costume party",
		"I was at 1489 Club",
		"a b c",
	}
	for _, s := range allowed {
		if IsObjectionable(s) {
			t.Errorf("IsObjectionable(%q) = true, want false", s)
		}
	}
}
