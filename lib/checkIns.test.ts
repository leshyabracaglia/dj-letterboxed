import type { CheckInPost } from "@/lib/api/types";
import { aReview, aUser } from "@/test/fixtures";

import { checkInsSince, nightListKey, withCheckIns } from "./checkIns";

function aCheckIn(id: string, createdAt: string): CheckInPost {
  return { id, createdAt, user: aUser(), venue: { id: "v1", name: "Good Room", city: null } };
}

describe("withCheckIns", () => {
  const reviews = [
    aReview({ id: "r1", seenAt: "2026-10-20T12:00:00Z" }),
    aReview({ id: "r2", seenAt: "2026-10-10T12:00:00Z" }),
  ];

  it("slots check-ins between nights by date, keeping each night's index", () => {
    const items = withCheckIns(
      reviews,
      [
        aCheckIn("c1", "2026-10-25T02:00:00Z"),
        aCheckIn("c2", "2026-10-15T02:00:00Z"),
        aCheckIn("c3", "2026-10-01T02:00:00Z"),
      ],
      (review) => review.seenAt,
    );
    expect(items.map(nightListKey)).toEqual(["check-in-c1", "r1", "check-in-c2", "r2", "check-in-c3"]);
    expect(items.flatMap((item) => (item.kind === "review" ? [item.index] : []))).toEqual([0, 1]);
  });

  it("is just the nights without check-ins", () => {
    expect(withCheckIns(reviews, [], (review) => review.seenAt).map(nightListKey)).toEqual(["r1", "r2"]);
  });
});

describe("checkInsSince", () => {
  it("is nothing while every night is loaded", () => {
    expect(checkInsSince({ items: [aReview()] })).toBeNull();
  });

  it("is the oldest night loaded when there could be more", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      aReview({ id: `r${i}`, seenAt: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z` }),
    );
    expect(checkInsSince({ items })).toBe("2026-10-20T12:00:00Z");
  });
});
