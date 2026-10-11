package domain

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode"
)

// Resident Advisor's listings feed the log screen's search: the nights on
// in someone's area over the last week, which prefill the log when picked.
// RA has no public API; this is the GraphQL endpoint ra.co itself calls, so
// keep the queries small and cached.

type RAArea struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Country string `json:"country"`
}

type RAArtist struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RAVenue struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
	Area    string `json:"area"`
}

type RAEvent struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	// Date is the night's calendar day, YYYY-MM-DD.
	Date string `json:"date"`
	// StartTime/EndTime are local wall-clock times, RFC3339 without a zone
	// (RA doesn't give one).
	StartTime string     `json:"startTime"`
	EndTime   string     `json:"endTime"`
	FlyerURL  *string    `json:"flyerUrl"`
	Attending int        `json:"attending"`
	URL       string     `json:"url"`
	Venue     RAVenue    `json:"venue"`
	Artists   []RAArtist `json:"artists"`
}

type raCacheEntry struct {
	value     any
	expiresAt time.Time
}

type RAClient struct {
	http *http.Client
	ttl  time.Duration

	mu    sync.Mutex
	cache map[string]raCacheEntry
}

func NewRAClient() *RAClient {
	return &RAClient{
		http:  &http.Client{Timeout: 8 * time.Second},
		ttl:   10 * time.Minute,
		cache: map[string]raCacheEntry{},
	}
}

func (c *RAClient) cached(key string, fetch func() (any, error)) (any, error) {
	c.mu.Lock()
	if e, ok := c.cache[key]; ok && e.expiresAt.After(time.Now()) {
		c.mu.Unlock()
		return e.value, nil
	}
	c.mu.Unlock()

	v, err := fetch()
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	// Drop expired entries as we go so the map can't grow without bound.
	for k, e := range c.cache {
		if e.expiresAt.Before(time.Now()) {
			delete(c.cache, k)
		}
	}
	c.cache[key] = raCacheEntry{value: v, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()
	return v, nil
}

func (c *RAClient) query(ctx context.Context, query string, variables map[string]any, out any) error {
	body, err := json.Marshal(map[string]any{"query": query, "variables": variables})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://ra.co/graphql", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	// RA turns away requests that don't look like they come from its site.
	req.Header.Set("Referer", "https://ra.co/events")
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Beatboxd/1.0; +https://beatboxd.com)")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("resident advisor query failed: %d: %s", resp.StatusCode, bytes.TrimSpace(detail))
	}

	var envelope struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return err
	}
	if len(envelope.Errors) > 0 {
		return fmt.Errorf("resident advisor query failed: %s", envelope.Errors[0].Message)
	}
	return json.Unmarshal(envelope.Data, out)
}

// SearchAreas finds RA areas (cities and regions) by name.
func (c *RAClient) SearchAreas(ctx context.Context, q string) ([]RAArea, error) {
	key := "areas:" + strings.ToLower(q)
	v, err := c.cached(key, func() (any, error) {
		var data struct {
			Search []struct {
				ID          string `json:"id"`
				Value       string `json:"value"`
				CountryName string `json:"countryName"`
			} `json:"search"`
		}
		err := c.query(ctx, `query($q: String!) {
			search(searchTerm: $q, limit: 8, indices: [AREA], includeNonLive: false) { id value countryName }
		}`, map[string]any{"q": q}, &data)
		if err != nil {
			return nil, err
		}
		out := make([]RAArea, 0, len(data.Search))
		for _, s := range data.Search {
			out = append(out, RAArea{ID: s.ID, Name: s.Value, Country: s.CountryName})
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	return v.([]RAArea), nil
}

const raEventFields = `id title date startTime endTime contentUrl attending
	images { filename type }
	venue { id name address area { name } }
	artists { id name }`

type raEventNode struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Date      string `json:"date"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	URL       string `json:"contentUrl"`
	Attending int    `json:"attending"`
	Images    []struct {
		Filename string `json:"filename"`
		Type     string `json:"type"`
	} `json:"images"`
	Venue *struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Address string `json:"address"`
		Area    *struct {
			Name string `json:"name"`
		} `json:"area"`
	} `json:"venue"`
	Artists []RAArtist `json:"artists"`
}

// RA's times are local wall-clock with a fake ".000" and no zone.
func trimRATime(s string) string {
	return strings.TrimSuffix(s, ".000")
}

func (n raEventNode) toEvent() RAEvent {
	e := RAEvent{
		ID:        n.ID,
		Title:     n.Title,
		Date:      n.Date,
		StartTime: trimRATime(n.StartTime),
		EndTime:   trimRATime(n.EndTime),
		Attending: n.Attending,
		URL:       "https://ra.co" + n.URL,
		Artists:   n.Artists,
	}
	if len(e.Date) >= 10 {
		e.Date = e.Date[:10]
	}
	if e.Artists == nil {
		e.Artists = []RAArtist{}
	}
	for _, img := range n.Images {
		if img.Type == "FLYERFRONT" && img.Filename != "" {
			url := img.Filename
			e.FlyerURL = &url
			break
		}
	}
	if n.Venue != nil {
		e.Venue = RAVenue{ID: n.Venue.ID, Name: n.Venue.Name, Address: n.Venue.Address}
		if n.Venue.Area != nil {
			e.Venue.Area = n.Venue.Area.Name
		}
	}
	return e
}

// EventListings returns the nights listed in an RA area between two days
// (inclusive, YYYY-MM-DD), most attended first.
func (c *RAClient) EventListings(ctx context.Context, areaID, from, to string) ([]RAEvent, error) {
	key := fmt.Sprintf("listings:%s:%s:%s", areaID, from, to)
	v, err := c.cached(key, func() (any, error) {
		var data struct {
			EventListings struct {
				Data []struct {
					Event raEventNode `json:"event"`
				} `json:"data"`
			} `json:"eventListings"`
		}
		var area int
		if _, err := fmt.Sscan(areaID, &area); err != nil {
			return nil, fmt.Errorf("bad RA area id %q", areaID)
		}
		err := c.query(ctx, `query($f: FilterInputDtoInput) {
			eventListings(filters: $f, pageSize: 100, page: 1, sort: { attending: { priority: 1, order: DESCENDING } }) {
				data { event { `+raEventFields+` } }
			}
		}`, map[string]any{"f": map[string]any{
			"areas":       map[string]any{"eq": area},
			"listingDate": map[string]any{"gte": from, "lte": to},
		}}, &data)
		if err != nil {
			return nil, err
		}
		out := make([]RAEvent, 0, len(data.EventListings.Data))
		seen := map[string]bool{}
		for _, d := range data.EventListings.Data {
			// Multi-day events are listed once per day.
			if seen[d.Event.ID] {
				continue
			}
			seen[d.Event.ID] = true
			out = append(out, d.Event.toEvent())
		}
		return out, nil
	})
	if err != nil {
		return nil, err
	}
	return v.([]RAEvent), nil
}

// Event fetches one RA event by id.
func (c *RAClient) Event(ctx context.Context, id string) (*RAEvent, error) {
	v, err := c.cached("event:"+id, func() (any, error) {
		var data struct {
			Event *raEventNode `json:"event"`
		}
		if err := c.query(ctx, `query($id: ID!) { event(id: $id) { `+raEventFields+` } }`,
			map[string]any{"id": id}, &data); err != nil {
			return nil, err
		}
		if data.Event == nil {
			return (*RAEvent)(nil), nil
		}
		e := data.Event.toEvent()
		return &e, nil
	})
	if err != nil {
		return nil, err
	}
	return v.(*RAEvent), nil
}

// RAEventName guesses the party's name from an RA title. "Serum: Dixon"
// is the Serum party; a title that's just the lineup ("Wata Igarashi all
// night long / ISAbella") or just the venue has no party name, so the log
// is headed by the venue instead.
func RAEventName(e RAEvent) string {
	title := strings.TrimSpace(e.Title)
	if i := strings.Index(title, ": "); i > 0 {
		title = strings.TrimSpace(title[:i])
	} else {
		lower := strings.ToLower(title)
		for _, a := range e.Artists {
			if a.Name != "" && strings.Contains(lower, strings.ToLower(a.Name)) {
				return ""
			}
		}
	}
	if strings.EqualFold(title, e.Venue.Name) {
		return ""
	}
	return title
}

// RADayNight says whether a night ran during the day, at night, or both,
// from its local start and end times. Unknown times count as night.
func RADayNight(e RAEvent) (isDay, isNight bool) {
	const layout = "2006-01-02T15:04:05"
	start, err1 := time.Parse(layout, e.StartTime)
	end, err2 := time.Parse(layout, e.EndTime)
	if err1 != nil || err2 != nil {
		return false, true
	}
	isDay = start.Hour() >= 6 && start.Hour() < 17
	isNight = !isDay || end.Hour() >= 21 || end.YearDay() != start.YearDay()
	return isDay, isNight
}

// RA lists New York as one area, but Google Places gives venues there
// borough or neighborhood cities.
var raAreaAliases = map[string]string{
	"brooklyn": "New York City", "queens": "New York City", "manhattan": "New York City",
	"bronx": "New York City", "the bronx": "New York City", "staten island": "New York City",
	"new york": "New York City", "ridgewood": "New York City", "maspeth": "New York City",
	"bushwick": "New York City", "long island city": "New York City",
}

// RAAreaQuery is what to search RA's areas for to find a city's area.
func RAAreaQuery(city string) string {
	if alias, ok := raAreaAliases[strings.ToLower(strings.TrimSpace(city))]; ok {
		return alias
	}
	return strings.TrimSpace(city)
}

// RAArtistName drops RA's billing notes from a lineup name: "Louis Marlo
// (live)" is Louis Marlo.
func RAArtistName(name string) string {
	name = strings.TrimSpace(name)
	if i := strings.LastIndex(name, " ("); i > 0 && strings.HasSuffix(name, ")") {
		name = strings.TrimSpace(name[:i])
	}
	return name
}

// SameNameLoosely compares names (artists, areas) loosely: case, spacing and punctuation
// aside ("DjRUM" is "Djrum", "Âme" is not "Ame" though).
func SameNameLoosely(a, b string) bool {
	norm := func(s string) string {
		var sb strings.Builder
		for _, r := range strings.ToLower(s) {
			if unicode.IsLetter(r) || unicode.IsDigit(r) {
				sb.WriteRune(r)
			}
		}
		return sb.String()
	}
	na, nb := norm(a), norm(b)
	if na == "" || nb == "" {
		return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
	}
	return na == nb
}
