import { aLineup, anEvent, aReview } from "@/test/fixtures";

import { getNightTitle, ratedSets, reviewSubject, soloSet } from "./review";

describe("getNightTitle", () => {
  it("is the event's name when it has one", () => {
    expect(getNightTitle(aReview({ event: anEvent(), lineup: aLineup("Dixon") }))).toBe("Innervisions NY");
  });

  it("is the DJs seen when there's no event, three then +N", () => {
    expect(getNightTitle(aReview({ lineup: aLineup("Dixon", "Âme") }))).toBe("Dixon, Âme");
    expect(getNightTitle(aReview({ lineup: aLineup("A", "B", "C", "D", "E") }))).toBe("A, B, C +2");
  });

  it("falls back when there's nothing to name it by", () => {
    expect(getNightTitle(aReview())).toBe("A night out");
    expect(getNightTitle(null)).toBe("A night out");
  });
});

describe("soloSet", () => {
  const unratedNight = { rating: null, reviewText: null };

  it("is the one DJ rated on a night with nothing said about the night", () => {
    const review = aReview({ ...unratedNight, lineup: aLineup({ name: "Dixon", rating: 5 }, "Âme") });
    expect(soloSet(review)?.dj.name).toBe("Dixon");
  });

  it("is null once the night itself is rated or reviewed", () => {
    const lineup = aLineup({ name: "Dixon", rating: 5 });
    expect(soloSet(aReview({ rating: 4, lineup }))).toBeNull();
    expect(soloSet(aReview({ ...unratedNight, reviewText: "Great", lineup }))).toBeNull();
  });

  it("is null with several DJs rated", () => {
    const review = aReview({ ...unratedNight, lineup: aLineup({ name: "A", rating: 5 }, { name: "B", rating: 3 }) });
    expect(soloSet(review)).toBeNull();
    expect(ratedSets(review)).toHaveLength(2);
  });
});

describe("reviewSubject", () => {
  it("is the night, with the venue as where (once, when it repeats the event)", () => {
    const subject = reviewSubject(aReview({ event: anEvent({ name: "Basement" }), venue: "basement" }));
    expect(subject).toMatchObject({ name: "Basement", isNight: true, where: ["Whole night"] });
  });

  it("links a night with no event to its venue", () => {
    expect(reviewSubject(aReview({ venueId: "v1" })).href).toBe("/venue/v1");
  });

  it("is the DJ when given a set", () => {
    const review = aReview({ event: anEvent(), lineup: aLineup({ name: "Dixon", rating: 5 }) });
    expect(reviewSubject(review, review.lineup[0])).toMatchObject({
      name: "Dixon",
      href: "/dj/dixon",
      isNight: false,
      where: ["Innervisions NY", "Basement"],
    });
  });
});
