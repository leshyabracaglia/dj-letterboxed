import { and, eq, inArray, sql } from "drizzle-orm";

import type { db as Db } from "../db/client";
import { reviewComments, reviewLikes, reviews } from "../db/schema";

export type Engagement = {
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
};

export async function attachEngagement(
  db: typeof Db,
  reviewIds: string[],
  currentUserId?: string,
): Promise<Record<string, Engagement>> {
  if (reviewIds.length === 0) return {};

  const [countRows, likedRows] = await Promise.all([
    db
      .select({
        reviewId: reviews.id,
        likeCount: sql<number>`count(distinct ${reviewLikes.userId})`,
        commentCount: sql<number>`count(distinct ${reviewComments.id})`,
      })
      .from(reviews)
      .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id))
      .leftJoin(reviewComments, eq(reviewComments.reviewId, reviews.id))
      .where(inArray(reviews.id, reviewIds))
      .groupBy(reviews.id),
    currentUserId
      ? db
          .select({ reviewId: reviewLikes.reviewId })
          .from(reviewLikes)
          .where(
            and(inArray(reviewLikes.reviewId, reviewIds), eq(reviewLikes.userId, currentUserId)),
          )
      : Promise.resolve([]),
  ]);

  const likedSet = new Set(likedRows.map((r) => r.reviewId));

  const result: Record<string, Engagement> = {};
  for (const row of countRows) {
    result[row.reviewId] = {
      likeCount: Number(row.likeCount),
      commentCount: Number(row.commentCount),
      isLikedByMe: likedSet.has(row.reviewId),
    };
  }
  return result;
}
