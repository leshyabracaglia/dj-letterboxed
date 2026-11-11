import { QueryClient } from "@tanstack/react-query";

import { aReview, aUser } from "@/test/fixtures";

import { findCachedReview, patchCachedReview } from "./cache";
import { queryKeys } from "./queryKeys";

describe("review cache helpers", () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = new QueryClient();
  });
  afterEach(() => queryClient.clear());

  it("patches every cached copy of a review, whatever shape its list is", () => {
    const review = aReview({ id: "r1", likeCount: 1 });
    queryClient.setQueryData(queryKeys.feed.activity(), { pages: [{ items: [review] }], pageParams: [undefined] });
    queryClient.setQueryData(queryKeys.djs.bySlug("dixon"), { recentReviews: [review] });
    queryClient.setQueryData(queryKeys.venues.byId("v1"), { reviews: [review] });

    patchCachedReview(queryClient, "r1", (r) => ({ ...r, likeCount: r.likeCount + 1 }));

    expect(queryClient.getQueryData<any>(queryKeys.feed.activity()).pages[0].items[0].likeCount).toBe(2);
    expect(queryClient.getQueryData<any>(queryKeys.djs.bySlug("dixon")).recentReviews[0].likeCount).toBe(2);
    expect(queryClient.getQueryData<any>(queryKeys.venues.byId("v1")).reviews[0].likeCount).toBe(2);
  });

  it("patches a review on a list page, but not the list itself", () => {
    // A list has an id and an author too; only a night has a lineup.
    const review = aReview({ id: "r1", likeCount: 1 });
    const list = { id: "r1", userId: "user-1", title: "Best closers", items: [{ id: "i1", review }] };
    queryClient.setQueryData(queryKeys.lists.byId("l1"), list);

    patchCachedReview(queryClient, "r1", (r) => ({ ...r, likeCount: 2 }));

    const patched = queryClient.getQueryData<any>(queryKeys.lists.byId("l1"));
    expect(patched.title).toBe("Best closers");
    expect(patched.items[0].review.likeCount).toBe(2);
  });

  it("leaves other reviews (and their objects) untouched", () => {
    const other = aReview({ id: "r2" });
    const data = { items: [other] };
    queryClient.setQueryData(queryKeys.reviews.byUser("raver"), data);
    patchCachedReview(queryClient, "r1", (r) => ({ ...r, likeCount: 99 }));
    expect(queryClient.getQueryData(queryKeys.reviews.byUser("raver"))).toBe(data);
  });

  it("finds a list's copy of a review, with its reviewer from anywhere in the cache", () => {
    // Profile lists leave `user` off their reviews; the profile carries it.
    const user = aUser({ id: "user-1" });
    queryClient.setQueryData(queryKeys.users.byUsername("raver"), { user });
    queryClient.setQueryData(queryKeys.reviews.byUser("raver"), { items: [aReview({ id: "r1", userId: "user-1" })] });

    expect(findCachedReview(queryClient, "r1")).toMatchObject({ id: "r1", user });
  });

  it("finds reviews on venue pages too", () => {
    queryClient.setQueryData(queryKeys.venues.byId("v1"), { reviews: [aReview({ id: "r1", user: aUser() })] });
    expect(findCachedReview(queryClient, "r1")?.id).toBe("r1");
  });

  it("finds nothing without a reviewer to show", () => {
    queryClient.setQueryData(queryKeys.feed.popular(), { items: [aReview({ id: "r1" })] });
    expect(findCachedReview(queryClient, "r1")).toBeUndefined();
  });
});
