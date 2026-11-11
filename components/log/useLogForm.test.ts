import { aDj } from "@/test/fixtures";

import type { ArtistPick, DraftLineupEntry } from "./draft";
import { initialLogFormState, logFormReducer, type LogFormAction, type LogFormState } from "./useLogForm";

const dixon: ArtistPick = { type: "existing", dj: aDj({ name: "Dixon" }) };

function run(...actions: LogFormAction[]): LogFormState {
  return actions.reduce(logFormReducer, initialLogFormState());
}

function listed(pick: ArtistPick, key: string): DraftLineupEntry {
  return { key, pick, reviewText: "", reviewing: false, caught: false, listed: true };
}

describe("logFormReducer", () => {
  it("adds a DJ as caught and closes the search", () => {
    const state = run({ type: "startAddingDj", query: "dix" }, { type: "addToLineup", pick: dixon });
    expect(state.lineup).toMatchObject([{ key: "dj-dj-dixon", caught: true }]);
    expect(state).toMatchObject({ addingDj: false, djQuery: "" });
  });

  it("ticks off a listed DJ instead of adding them twice", () => {
    const state = run(
      { type: "openForm", draft: initialLogFormState().draft, lineup: [listed(dixon, "dj-dj-dixon")] },
      { type: "addToLineup", pick: dixon },
    );
    expect(state.lineup).toHaveLength(1);
    expect(state.lineup[0].caught).toBe(true);
  });

  it("unticks a listed DJ on remove, but drops one you added", () => {
    const fromRA = run(
      { type: "openForm", draft: initialLogFormState().draft, lineup: [{ ...listed(dixon, "k"), caught: true }] },
      { type: "removeEntry", key: "k" },
    );
    expect(fromRA.lineup).toMatchObject([{ key: "k", caught: false }]);

    const added = run({ type: "addToLineup", pick: dixon }, { type: "removeEntry", key: "dj-dj-dixon" });
    expect(added.lineup).toEqual([]);
  });

  it("edits a hand-made artist in place, or adds a new one", () => {
    const added = run({ type: "openArtistSheet", editingKey: null }, { type: "saveArtist", input: { name: "Nobody" } });
    expect(added.lineup).toMatchObject([{ key: "new-nobody", pick: { type: "new", input: { name: "Nobody" } } }]);
    expect(added.artistSheet).toBeUndefined();

    const edited = logFormReducer(logFormReducer(added, { type: "openArtistSheet", editingKey: "new-nobody" }), {
      type: "saveArtist",
      input: { name: "Somebody" },
    });
    expect(edited.lineup).toHaveLength(1);
    expect(edited.lineup[0]).toMatchObject({ key: "new-nobody", pick: { input: { name: "Somebody" } } });
  });

  it("clears a missing field's outline once it's filled in", () => {
    const flagged = run({ type: "flagMissing", field: "venue" });
    expect(flagged).toMatchObject({ venueMissing: true });

    const written = logFormReducer(flagged, { type: "updateDraft", changes: { reviewText: "Great" } });
    expect(written).toMatchObject({ venueMissing: true });

    const placed = logFormReducer(written, {
      type: "updateDraft",
      changes: { venuePick: { type: "typed", name: "Basement", city: "" } },
    });
    expect(placed.venueMissing).toBe(false);
  });

  it("forgets the venue sheet's query when it closes", () => {
    const open = run({ type: "openSheet", sheet: "venue", venueQuery: "base" });
    expect(open).toMatchObject({ sheet: "venue", venueSheetQuery: "base" });
    expect(logFormReducer(open, { type: "closeSheet" })).toMatchObject({ sheet: undefined, venueSheetQuery: "" });
  });

  it("resets everything, back to the search", () => {
    const state = run(
      { type: "openForm", draft: initialLogFormState().draft, filledFrom: "Resident Advisor", sourceReviewId: "r1" },
      { type: "addToLineup", pick: dixon },
      { type: "setError", error: "oops" },
      { type: "reset" },
    );
    expect(state).toEqual({ ...initialLogFormState(), draft: expect.any(Object) });
  });

  describe("tracks", () => {
    const rej = { key: "t1", title: "Rej", artist: "Âme", note: "" };

    it("opens the track sheet for a DJ's set, and saving adds the track and closes it", () => {
      const opened = run({ type: "openTrackSheet", djKey: "dj-dj-dixon" });
      expect(opened.trackSheet).toEqual({ djKey: "dj-dj-dixon", editingKey: undefined });

      const saved = logFormReducer(opened, { type: "saveTrack", track: { ...rej, djKey: "dj-dj-dixon" } });
      expect(saved.draft.tracks).toEqual([{ ...rej, djKey: "dj-dj-dixon" }]);
      expect(saved.trackSheet).toBeUndefined();
    });

    it("saving an edited track replaces it in place", () => {
      const state = run(
        { type: "saveTrack", track: rej },
        { type: "saveTrack", track: { key: "t2", title: "", artist: "", note: "Sax at 3am" } },
        { type: "openTrackSheet", editingKey: "t1" },
        { type: "saveTrack", track: { ...rej, note: "The riff" } },
      );
      expect(state.draft.tracks.map((t) => [t.key, t.note])).toEqual([
        ["t1", "The riff"],
        ["t2", "Sax at 3am"],
      ]);
    });

    it("removes a track, and closing the sheet saves nothing", () => {
      const state = run(
        { type: "saveTrack", track: rej },
        { type: "openTrackSheet" },
        { type: "closeTrackSheet" },
        { type: "removeTrack", key: "t1" },
      );
      expect(state.draft.tracks).toEqual([]);
      expect(state.trackSheet).toBeUndefined();
    });
  });
});
