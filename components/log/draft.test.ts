import type { TrackMatch } from "@/lib/api/types";
import { aDj } from "@/test/fixtures";

import {
  draftProblem,
  type DraftLineupEntry,
  type DraftTrack,
  emptyDraft,
  type ReviewDraft,
  trackInputCount,
  trackInputs,
} from "./draft";

function aDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    ...emptyDraft(),
    seenAt: "2026-09-14",
    venuePick: { type: "typed", name: "Basement", city: "New York" },
    ...overrides,
  };
}

describe("draftProblem", () => {
  it("passes a complete draft, with nothing written", () => expect(draftProblem(aDraft())).toBeUndefined());

  it("flags a missing venue on the poster rather than with a message", () => {
    expect(draftProblem(aDraft({ venuePick: undefined }))).toEqual({ field: "venue" });
  });

  it("refuses a night that hasn't happened yet", () => {
    expect(draftProblem(aDraft({ seenAt: "2999-01-01" }))?.message).toMatch(/hasn't happened/);
  });

  it("needs day, night or both", () => {
    expect(draftProblem(aDraft({ isDay: false, isNight: false }))?.message).toBe("Pick day, night, or both");
  });
});

describe("trackInputs", () => {
  const dixon: DraftLineupEntry = {
    key: "dj-dixon",
    pick: { type: "existing", dj: aDj({ name: "Dixon" }) },
    reviewText: "",
    reviewing: false,
    caught: true,
  };
  const djIdFor = (entry: DraftLineupEntry) => (entry.pick.type === "existing" ? entry.pick.dj.id : "");
  const blank: DraftTrack = { key: "t", title: "", artist: "", note: "" };
  const rej: TrackMatch = {
    source: "spotify",
    externalId: "3rYAvF4f1aTbQ5hrIpcCPk",
    url: "https://open.spotify.com/track/3rYAvF4f1aTbQ5hrIpcCPk",
    title: "Rej",
    artist: "Âme",
    artworkUrl: null,
  };

  it("sends a found track with its DJ's id and the note", () => {
    const [input] = trackInputs([{ ...blank, djKey: dixon.key, match: rej, note: " Huge " }], [dixon], djIdFor);
    expect(input).toMatchObject({ djId: "dj-dixon", source: "spotify", externalId: rej.externalId, note: "Huge" });
    expect(input.artworkUrl).toBeUndefined();
  });

  it("sends a typed-in track, or an ID with just a note, from the night", () => {
    expect(trackInputs([{ ...blank, title: "Edit", artist: "Someone" }], [], djIdFor)).toEqual([
      { djId: undefined, source: "manual", title: "Edit", artist: "Someone", note: undefined },
    ]);
    expect(trackInputs([{ ...blank, artist: "Ignored", note: "Sax at 3am" }], [], djIdFor)).toEqual([
      { djId: undefined, source: "manual", title: undefined, artist: undefined, note: "Sax at 3am" },
    ]);
  });

  it("leaves out empty tracks and those of a DJ no longer caught", () => {
    expect(trackInputs([blank, { ...blank, djKey: "dj-gone", match: rej }], [dixon], djIdFor)).toEqual([]);
    expect(trackInputCount([blank, { ...blank, djKey: "dj-gone" }, { ...blank, djKey: dixon.key }], [dixon])).toBe(2);
  });
});
