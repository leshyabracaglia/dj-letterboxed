import type { CheckInPost, Review } from "@/lib/api/types";

/** A list of nights with check-ins slotted in by date: a review keeps its
 * `index` among the reviews (it picks the card's paper). */
export type NightListItem =
  { kind: "review"; review: Review; index: number } | { kind: "checkIn"; checkIn: CheckInPost };

/** Slots `checkIns` (newest first) into `reviews` (newest first by `dateOf`). */
export function withCheckIns(
  reviews: Review[],
  checkIns: CheckInPost[],
  dateOf: (review: Review) => string,
): NightListItem[] {
  const items: NightListItem[] = [];
  let c = 0;
  reviews.forEach((review, index) => {
    const at = new Date(dateOf(review)).getTime();
    while (c < checkIns.length && new Date(checkIns[c].createdAt).getTime() > at) {
      items.push({ kind: "checkIn", checkIn: checkIns[c++] });
    }
    items.push({ kind: "review", review, index });
  });
  while (c < checkIns.length) items.push({ kind: "checkIn", checkIn: checkIns[c++] });
  return items;
}

// The profile loads one page of nights (by night, newest first): while
// there could be more, only check-ins since its oldest night slot in.
const PROFILE_PAGE = 20;
export function checkInsSince(page: { items: Review[] } | undefined): string | null {
  if (!page || page.items.length < PROFILE_PAGE) return null;
  return page.items.at(-1)?.seenAt ?? null;
}

export function nightListKey(item: NightListItem): string {
  return item.kind === "review" ? item.review.id : `check-in-${item.checkIn.id}`;
}
