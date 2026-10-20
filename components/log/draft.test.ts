import { draftProblem, emptyDraft, type ReviewDraft } from "./draft";

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
