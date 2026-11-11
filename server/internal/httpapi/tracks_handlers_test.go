package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// m4a is the start of an M4A file: a box size, then its "ftyp" box.
func m4a(size int) []byte {
	b := make([]byte, size)
	copy(b, "\x00\x00\x00\x1cftypM4A ")
	return b
}

// TestReadClip covers what an uploaded clip must be: an M4A by its type and
// its bytes, 15 seconds at most, and small.
func TestReadClip(t *testing.T) {
	cases := []struct {
		name        string
		contentType string
		durationMs  string
		body        []byte
		wantErr     string
	}{
		{name: "a 6s recording", contentType: "audio/mp4", durationMs: "6000", body: m4a(28_000)},
		{name: "m4a type with parameters", contentType: "audio/x-m4a; codecs=mp4a.40.2", durationMs: "15000", body: m4a(200)},
		{name: "just over 15s is allowed slack", contentType: "audio/mp4", durationMs: "15400", body: m4a(200)},
		{name: "too long", contentType: "audio/mp4", durationMs: "16000", body: m4a(200), wantErr: "a clip can be at most 15 seconds"},
		{name: "no duration", contentType: "audio/mp4", body: m4a(200), wantErr: "a clip can be at most 15 seconds"},
		{name: "zero duration", contentType: "audio/mp4", durationMs: "0", body: m4a(200), wantErr: "a clip can be at most 15 seconds"},
		{name: "not audio", contentType: "image/png", durationMs: "6000", body: m4a(200), wantErr: "a clip must be an M4A recording"},
		{name: "web recording (webm)", contentType: "audio/webm", durationMs: "6000", body: m4a(200), wantErr: "a clip must be an M4A recording"},
		{
			name: "says m4a but isn't", contentType: "audio/mp4", durationMs: "6000", body: []byte("<html>definitely audio</html>"),
			wantErr: "a clip must be an M4A recording of at most 15 seconds",
		},
		{name: "too short to be a file", contentType: "audio/mp4", durationMs: "6000", body: []byte("ftyp"), wantErr: "a clip must be an M4A recording of at most 15 seconds"},
		{name: "too big", contentType: "audio/mp4", durationMs: "6000", body: m4a(maxClipBytes + 1), wantErr: "a clip must be an M4A recording of at most 15 seconds"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPut, "/api/tracks/x/clip", bytes.NewReader(tc.body))
			r.Header.Set("Content-Type", tc.contentType)
			if tc.durationMs != "" {
				r.Header.Set("X-Clip-Duration-Ms", tc.durationMs)
			}
			audio, _, errMsg := readClip(r)
			if errMsg != tc.wantErr {
				t.Fatalf("error = %q, want %q", errMsg, tc.wantErr)
			}
			if tc.wantErr == "" && len(audio) != len(tc.body) {
				t.Fatalf("read %d bytes, want %d", len(audio), len(tc.body))
			}
		})
	}
}

// TestListRequestValidate covers a list's title and description: trimmed,
// a title required, both capped, and run through the content filter.
func TestListRequestValidate(t *testing.T) {
	str := func(s string) *string { return &s }
	cases := []struct {
		name      string
		req       listRequest
		wantTitle string
		wantDesc  *string
		wantErr   string
	}{
		{name: "title and description, trimmed", req: listRequest{Title: "  Best closers  ", Description: str(" The last hour. ")}, wantTitle: "Best closers", wantDesc: str("The last hour.")},
		{name: "blank description is none", req: listRequest{Title: "Sunset sets", Description: str("   ")}, wantTitle: "Sunset sets"},
		{name: "no title", req: listRequest{Title: "   "}, wantErr: "give the list a title"},
		{name: "title too long", req: listRequest{Title: strings.Repeat("a", 101)}, wantErr: "title too long"},
		{name: "description too long", req: listRequest{Title: "T", Description: str(strings.Repeat("a", 1001))}, wantErr: "description too long"},
		{name: "slur", req: listRequest{Title: "kys"}, wantErr: "that includes language that isn't allowed on Beatboxd"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			title, desc, errMsg := tc.req.validate()
			if errMsg != tc.wantErr {
				t.Fatalf("error = %q, want %q", errMsg, tc.wantErr)
			}
			if tc.wantErr != "" {
				return
			}
			if title != tc.wantTitle || deref(desc) != deref(tc.wantDesc) || (desc == nil) != (tc.wantDesc == nil) {
				t.Fatalf("got %q / %v, want %q / %v", title, desc, tc.wantTitle, tc.wantDesc)
			}
		})
	}
}
