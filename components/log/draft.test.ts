import { aDj } from "@/test/fixtures";

import { draftProblem, emptyDraft, type DraftLineupEntry, type ReviewDraft } from "./draft";

function aDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    ...emptyDraft(),
    seenAt: "2026-09-14",
    venuePick: { type: "typed", name: "Basement", city: "New York" },
    rating: 4,
    ...overrides,
  };
}

const dixon = (overrides: Partial<DraftLineupEntry> = {}): DraftLineupEntry => ({
  key: "dj-dixon",
  pick: { type: "existing", dj: aDj({ name: "Dixon" }) },
  reviewText: "",
  reviewing: false,
  caught: true,
  ...overrides,
});

describe("draftProblem", () => {
  it("passes a complete draft", () => expect(draftProblem(aDraft(), [dixon({ rating: 5 })])).toBeUndefined());

  it("flags a missing venue on the poster rather than with a message", () => {
    expect(draftProblem(aDraft({ venuePick: undefined }), [])).toEqual({ field: "venue" });
  });

  it("refuses a night that hasn't happened yet", () => {
    expect(draftProblem(aDraft({ seenAt: "2999-01-01" }), [])?.message).toMatch(/hasn't happened/);
  });

  it("needs day, night or both", () => {
    expect(draftProblem(aDraft({ isDay: false, isNight: false }), [])?.message).toBe("Pick day, night, or both");
  });

  it("needs the night rated", () => {
    expect(draftProblem(aDraft({ rating: undefined }), [])).toEqual({
      field: "night",
      message: "Rate the night overall",
    });
  });

  it("won't drop words written about a DJ who wasn't rated", () => {
    expect(draftProblem(aDraft(), [dixon({ reviewText: "Unreal closing set" })])?.message).toBe(
      "Rate Dixon to save what you wrote about them",
    );
  });
});
