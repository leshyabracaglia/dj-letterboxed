import { aLineup, anEvent, aReview } from "@/test/fixtures";

import { getNightTitle, reviewedSets, reviewSubject, soloSet, tracksFrom } from "./review";

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
  it("is the one DJ written about on a night with nothing said about the night", () => {
    const review = aReview({ lineup: aLineup({ name: "Dixon", reviewText: "Unreal" }, "Âme") });
    expect(soloSet(review)?.dj.name).toBe("Dixon");
  });

  it("is null once the night itself is written about", () => {
    const lineup = aLineup({ name: "Dixon", reviewText: "Unreal" });
    expect(soloSet(aReview({ reviewText: "Great", lineup }))).toBeNull();
  });

  it("is null with several DJs written about", () => {
    const review = aReview({ lineup: aLineup({ name: "A", reviewText: "Big" }, { name: "B", reviewText: "Deep" }) });
    expect(soloSet(review)).toBeNull();
    expect(reviewedSets(review)).toHaveLength(2);
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
    const review = aReview({ event: anEvent(), lineup: aLineup({ name: "Dixon", reviewText: "Unreal" }) });
    expect(reviewSubject(review, review.lineup[0])).toMatchObject({
      name: "Dixon",
      href: "/dj/dixon",
      isNight: false,
      where: ["Innervisions NY", "Basement"],
    });
  });
});

describe("tracks on a night", () => {
  const dixon = aLineup("Dixon")[0];
  const track = (djId: string | null) => ({
    id: `t-${djId}`,
    reviewId: "review-1",
    djId,
    source: "manual",
    externalId: null,
    url: null,
    title: "Rej",
    artist: "Âme",
    artworkUrl: null,
    note: null,
    identifiedBy: null,
  });

  it("counts a set with only a track as reviewed, and the post as that DJ's", () => {
    const review = aReview({ lineup: [dixon, ...aLineup("Âme")], tracks: [track(dixon.dj.id)] });
    expect(reviewedSets(review).map((e) => e.dj.name)).toEqual(["Dixon"]);
    expect(soloSet(review)?.dj.name).toBe("Dixon");
  });

  it("keeps a post with tracks from the night about the night", () => {
    const review = aReview({ lineup: [dixon], tracks: [track(dixon.dj.id), track(null)] });
    expect(soloSet(review)).toBeNull();
    expect(tracksFrom(review, null)).toHaveLength(1);
  });
});
