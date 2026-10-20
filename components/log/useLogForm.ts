import { useMemo, useReducer } from "react";

import type { CreateDjInput } from "@/lib/api/types";
import {
  artistPickKey,
  type ArtistPick,
  type DraftLineupEntry,
  type DraftTrack,
  emptyDraft,
  type PosterSheet,
  type ReviewDraft,
} from "./draft";

// The log tab's state, from the search through the filled-in poster: one
// reducer, so starting over is a single reset rather than a dozen setters.

export type LogFormState = {
  // The tab opens on the search; picking a night (or a blank poster) moves
  // on to the poster form.
  stage: "search" | "form";
  draft: ReviewDraft;
  lineup: DraftLineupEntry[];
  // Where the poster was filled in from ("Resident Advisor", "@dj's log"),
  // shown under it.
  filledFrom?: string;
  // The review it was filled in from (ROUTES.REVIEW_FROM), until it's logged.
  sourceReviewId?: string;
  error?: string;
  // Required fields the last submit found missing, outlined on the form.
  venueMissing: boolean;
  sheet?: PosterSheet;
  // What the venue sheet opens searching for.
  venueSheetQuery: string;
  // The DJ search under the lineup is open.
  addingDj: boolean;
  djQuery: string;
  // The artist sheet, open for a new artist (null) or to edit a hand-made
  // one in the lineup (its key).
  artistSheet?: { editingKey: string | null };
  // The track sheet, open to add a track (for a DJ's set, by their entry's
  // key, or the night's) or to edit one (its key).
  trackSheet?: { djKey?: string; editingKey?: string };
};

export type LogFormAction =
  | { type: "reset" }
  | {
      type: "openForm";
      draft: ReviewDraft;
      lineup?: DraftLineupEntry[];
      filledFrom?: string;
      sourceReviewId?: string;
      error?: string;
    }
  | { type: "updateDraft"; changes: Partial<ReviewDraft> }
  | { type: "updateEntry"; key: string; changes: Partial<DraftLineupEntry> }
  | { type: "removeEntry"; key: string }
  | { type: "addToLineup"; pick: ArtistPick }
  | { type: "saveArtist"; input: CreateDjInput }
  | { type: "setError"; error?: string }
  | { type: "flagMissing"; field: "venue" }
  | { type: "openSheet"; sheet: PosterSheet; venueQuery?: string }
  | { type: "closeSheet" }
  | { type: "startAddingDj"; query?: string }
  | { type: "cancelAddingDj" }
  | { type: "setDjQuery"; query: string }
  | { type: "openArtistSheet"; editingKey: string | null }
  | { type: "closeArtistSheet" }
  | { type: "openTrackSheet"; djKey?: string; editingKey?: string }
  | { type: "closeTrackSheet" }
  | { type: "saveTrack"; track: DraftTrack }
  | { type: "removeTrack"; key: string };

export function initialLogFormState(): LogFormState {
  return {
    stage: "search",
    draft: emptyDraft(),
    lineup: [],
    venueMissing: false,
    venueSheetQuery: "",
    addingDj: false,
    djQuery: "",
  };
}

function withEntry(lineup: DraftLineupEntry[], key: string, changes: Partial<DraftLineupEntry>) {
  return lineup.map((e) => (e.key === key ? { ...e, ...changes } : e));
}

// Adding a DJ who's already listed (from the RA lineup) ticks them off
// rather than adding them twice.
function addPick(lineup: DraftLineupEntry[], pick: ArtistPick): DraftLineupEntry[] {
  const key = artistPickKey(pick);
  return lineup.some((e) => e.key === key)
    ? withEntry(lineup, key, { caught: true })
    : [...lineup, { key, pick, reviewText: "", reviewing: false, caught: true }];
}

export function logFormReducer(state: LogFormState, action: LogFormAction): LogFormState {
  switch (action.type) {
    case "reset":
      return initialLogFormState();
    case "openForm":
      return {
        ...state,
        stage: "form",
        draft: action.draft,
        lineup: action.lineup ?? [],
        filledFrom: action.filledFrom,
        sourceReviewId: action.sourceReviewId,
        error: action.error,
      };
    case "updateDraft": {
      const { changes } = action;
      return {
        ...state,
        draft: { ...state.draft, ...changes },
        // Filling in a missing field clears its outline.
        venueMissing: state.venueMissing && !changes.venuePick,
      };
    }
    case "updateEntry":
      return { ...state, lineup: withEntry(state.lineup, action.key, action.changes) };
    case "removeEntry": {
      const entry = state.lineup.find((e) => e.key === action.key);
      // A listed DJ is only unticked (they stay on the checklist); one you
      // added goes.
      return {
        ...state,
        lineup: entry?.listed
          ? withEntry(state.lineup, action.key, { caught: false })
          : state.lineup.filter((e) => e.key !== action.key),
      };
    }
    case "addToLineup":
      return { ...state, lineup: addPick(state.lineup, action.pick), addingDj: false, djQuery: "" };
    case "saveArtist": {
      const editingKey = state.artistSheet?.editingKey;
      const pick: ArtistPick = { type: "new", input: action.input };
      return {
        ...state,
        lineup: editingKey ? withEntry(state.lineup, editingKey, { pick }) : addPick(state.lineup, pick),
        artistSheet: undefined,
        ...(editingKey ? {} : { addingDj: false, djQuery: "" }),
      };
    }
    case "setError":
      return { ...state, error: action.error };
    case "flagMissing":
      return { ...state, venueMissing: true };
    case "openSheet":
      return { ...state, sheet: action.sheet, venueSheetQuery: action.venueQuery ?? state.venueSheetQuery };
    case "closeSheet":
      return { ...state, sheet: undefined, venueSheetQuery: "" };
    case "startAddingDj":
      return { ...state, addingDj: true, djQuery: action.query ?? state.djQuery };
    case "cancelAddingDj":
      return { ...state, addingDj: false, djQuery: "" };
    case "setDjQuery":
      return { ...state, djQuery: action.query };
    case "openArtistSheet":
      return { ...state, artistSheet: { editingKey: action.editingKey } };
    case "closeArtistSheet":
      return { ...state, artistSheet: undefined };
    case "openTrackSheet":
      return { ...state, trackSheet: { djKey: action.djKey, editingKey: action.editingKey } };
    case "closeTrackSheet":
      return { ...state, trackSheet: undefined };
    case "saveTrack": {
      const { tracks } = state.draft;
      const { track } = action;
      return {
        ...state,
        draft: {
          ...state.draft,
          tracks: tracks.some((t) => t.key === track.key)
            ? tracks.map((t) => (t.key === track.key ? track : t))
            : [...tracks, track],
        },
        trackSheet: undefined,
      };
    }
    case "removeTrack":
      return { ...state, draft: { ...state.draft, tracks: state.draft.tracks.filter((t) => t.key !== action.key) } };
  }
}

/** The log form's state, plus what's derived from it: the DJs ticked as
 * caught, the ones listed on the night's lineup, the hand-made artist the
 * artist sheet is editing, and the track the track sheet is editing. */
export function useLogForm() {
  const [state, dispatch] = useReducer(logFormReducer, undefined, initialLogFormState);
  const derived = useMemo(
    () => ({
      caught: state.lineup.filter((e) => e.caught),
      listedLineup: state.lineup.filter((e) => e.listed),
      editingEntry: state.lineup.find((e) => e.key === state.artistSheet?.editingKey),
      editingTrack: state.draft.tracks.find((t) => t.key === state.trackSheet?.editingKey),
    }),
    [state.lineup, state.artistSheet, state.draft.tracks, state.trackSheet],
  );
  return { state, dispatch, ...derived };
}
