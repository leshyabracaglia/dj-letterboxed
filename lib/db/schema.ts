import { relations } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const crowdVibeEnum = pgEnum("crowd_vibe", [
  "electric",
  "good",
  "average",
  "dead",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  displayName: varchar("display_name", { length: 64 }),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const djs = pgTable("djs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  bio: text("bio"),
  genres: text("genres").array(),
  imageUrl: text("image_url"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    venue: varchar("venue", { length: 160 }).notNull(),
    city: varchar("city", { length: 120 }),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    description: text("description"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dedupe: uniqueIndex("events_name_venue_date_idx").on(
      t.name,
      t.venue,
      t.eventDate,
    ),
  }),
);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  djId: uuid("dj_id")
    .notNull()
    .references(() => djs.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  // 1-10, half-star increments; UI divides by 2 for a 0.5-5.0 star display.
  ratingHalfStars: smallint("rating_half_stars"),
  reviewText: text("review_text"),
  crowdVibe: crowdVibeEnum("crowd_vibe"),
  crowdVibeNote: varchar("crowd_vibe_note", { length: 280 }),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reviewLikes = pgTable(
  "review_likes",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.reviewId, t.userId] }),
  }),
);

export const reviewComments = pgTable("review_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: varchar("body", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.followerId, t.followingId] }),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  reviews: many(reviews),
  reviewLikes: many(reviewLikes),
  reviewComments: many(reviewComments),
  djsCreated: many(djs),
  eventsCreated: many(events),
  followers: many(follows, { relationName: "following" }),
  following: many(follows, { relationName: "follower" }),
}));

export const djsRelations = relations(djs, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [djs.createdByUserId],
    references: [users.id],
  }),
  reviews: many(reviews),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [events.createdByUserId],
    references: [users.id],
  }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  dj: one(djs, { fields: [reviews.djId], references: [djs.id] }),
  event: one(events, { fields: [reviews.eventId], references: [events.id] }),
  likes: many(reviewLikes),
  comments: many(reviewComments),
}));

export const reviewLikesRelations = relations(reviewLikes, ({ one }) => ({
  review: one(reviews, { fields: [reviewLikes.reviewId], references: [reviews.id] }),
  user: one(users, { fields: [reviewLikes.userId], references: [users.id] }),
}));

export const reviewCommentsRelations = relations(reviewComments, ({ one }) => ({
  review: one(reviews, { fields: [reviewComments.reviewId], references: [reviews.id] }),
  user: one(users, { fields: [reviewComments.userId], references: [users.id] }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export type User = typeof users.$inferSelect;
export type Dj = typeof djs.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ReviewLike = typeof reviewLikes.$inferSelect;
export type ReviewComment = typeof reviewComments.$inferSelect;
export type Follow = typeof follows.$inferSelect;
