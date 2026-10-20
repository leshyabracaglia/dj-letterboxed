package domain

import (
	"errors"
	"strings"
	"unicode"
)

// ErrObjectionable is returned for text the content filter rejects.
var ErrObjectionable = errors.New("that includes language that isn't allowed on Beatboxd")

// The content filter Apple's guideline 1.2 asks of an app with user posts:
// it stops slurs, hate, sexual content involving minors and "kill yourself"
// style abuse before they're posted. It deliberately leaves ordinary
// swearing alone (people swear about nights out), and it's a first line
// only: reports and blocks catch what a word list can't.
//
// Matching is on normalized words, so it sees through case, punctuation,
// spacing ("n i g g e r"), stretched letters and common digit swaps, without
// matching innocent words that merely contain a term.

// blockedWords match a whole word, or the word plus a plural ending.
var blockedWords = setOf(
	// Racial and ethnic slurs.
	"nigger", "nigga", "niggah", "chink", "gook", "spic", "spick", "wetback", "kike", "raghead",
	"towelhead", "beaner", "coon", "paki", "sambo", "jigaboo", "zipperhead", "gyppo",
	// Homophobic, transphobic and ableist slurs.
	// ("retard" alone is French for "late", so only "retarded".)
	"faggot", "fagot", "faggit", "tranny", "trannie", "shemale", "retarded",
	// Sexual content involving minors. ("pedo" alone is everyday Mexican
	// Spanish slang, and "loli" a nickname, so neither is here.)
	"jailbait", "lolicon", "shotacon", "childporn", "pedophile", "paedophile",
	// Abuse.
	"kys",
)

// blockedInWords match anywhere inside a word, for slurs glued into
// usernames ("xxniggerxx"). Only terms no ordinary word contains belong here;
// innocentWords lists the exceptions that do.
var blockedInWords = []string{"nigger", "nigga", "faggot", "childporn", "lolicon"}

var innocentWords = setOf("snigger", "sniggers", "sniggered", "sniggering")

// blockedPhrases match a run of whole words.
var blockedPhrases = [][]string{
	{"kill", "yourself"}, {"kill", "urself"}, {"kill", "your", "self"}, {"killyourself"},
	{"heil", "hitler"}, {"sieg", "heil"}, {"white", "power"}, {"gas", "the", "jews"},
}

// blockedNumbers are hate codes, matched as whole numbers before digits are
// read as letters.
var blockedNumbers = setOf("1488")

// lookalikes are digits and symbols read as the letter they stand in for,
// when they're part of a word ("n1gger", "$pic").
var lookalikes = map[rune]rune{
	'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
}

// IsObjectionable reports whether any of texts contains blocked language.
func IsObjectionable(texts ...string) bool {
	for _, t := range texts {
		if objectionable(t) {
			return true
		}
	}
	return false
}

func objectionable(text string) bool {
	if text == "" {
		return false
	}
	for _, n := range strings.FieldsFunc(text, func(r rune) bool { return !unicode.IsDigit(r) }) {
		if blockedNumbers[n] {
			return true
		}
	}

	words := normalizedWords(text)
	for _, w := range words {
		if isBlockedWord(w) {
			return true
		}
	}
	for _, p := range blockedPhrases {
		if containsRun(words, p) {
			return true
		}
	}
	return false
}

func isBlockedWord(w string) bool {
	for _, suffix := range []string{"", "s", "es", "z"} {
		if stem, ok := strings.CutSuffix(w, suffix); ok && blockedWords[stem] {
			return true
		}
	}
	if innocentWords[w] {
		return false
	}
	for _, term := range blockedInWords {
		if strings.Contains(w, term) {
			return true
		}
	}
	return false
}

// normalizedWords splits text into lowercase letter-only words: lookalike
// digits and symbols inside a word become letters, runs of three or more of
// a letter shrink to two (so a stretched "nigggger" reads "nigger"), and
// single letters spaced out ("n i g g e r") join up.
func normalizedWords(text string) []string {
	runes := []rune(strings.ToLower(text))
	isLetterAt := func(i int) bool { return i >= 0 && i < len(runes) && unicode.IsLetter(runes[i]) }

	var words []string
	var cur []rune
	flush := func() {
		if len(cur) > 0 {
			words = append(words, string(squeeze(cur)))
			cur = nil
		}
	}
	for i, r := range runes {
		if l, ok := lookalikes[r]; ok && (isLetterAt(i-1) || isLetterAt(i+1)) {
			r = l
		}
		if unicode.IsLetter(r) {
			cur = append(cur, r)
		} else {
			flush()
		}
	}
	flush()
	return joinSpacedLetters(words)
}

// squeeze shrinks every run of three or more of a letter to two.
func squeeze(w []rune) []rune {
	out := w[:0:0]
	for i, r := range w {
		if i >= 2 && r == w[i-1] && r == w[i-2] {
			continue
		}
		out = append(out, r)
	}
	return out
}

// joinSpacedLetters merges runs of three or more single-letter words into
// one word, keeping the letters as words too ("i a m" stays matchable both
// ways).
func joinSpacedLetters(words []string) []string {
	out := words
	for i := 0; i < len(words); {
		j := i
		for j < len(words) && len([]rune(words[j])) == 1 {
			j++
		}
		if j-i >= 3 {
			out = append(out, strings.Join(words[i:j], ""))
		}
		if j == i {
			j++
		}
		i = j
	}
	return out
}

func containsRun(words, phrase []string) bool {
	for i := 0; i+len(phrase) <= len(words); i++ {
		match := true
		for k, p := range phrase {
			if words[i+k] != p {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func setOf(items ...string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, s := range items {
		m[s] = true
	}
	return m
}
