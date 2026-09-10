import { db } from "./client";
import { djs, events, follows, reviewComments, reviewLikes, reviews, users } from "./schema";

async function main() {
  console.log("Seeding dev data...");

  const [alice, bob] = await db
    .insert(users)
    .values([
      {
        clerkId: "seed_alice",
        username: "alice",
        displayName: "Alice",
        bio: "Techno head, always front row.",
      },
      {
        clerkId: "seed_bob",
        username: "bob",
        displayName: "Bob",
        bio: "House music, warehouse parties.",
      },
    ])
    .returning();

  const [dj1, dj2, dj3] = await db
    .insert(djs)
    .values([
      {
        name: "Nova Reyes",
        slug: "nova-reyes",
        bio: "Melodic techno producer and DJ.",
        genres: ["techno", "melodic techno"],
        createdByUserId: alice.id,
      },
      {
        name: "Deep Current",
        slug: "deep-current",
        bio: "Deep house selector.",
        genres: ["house", "deep house"],
        createdByUserId: bob.id,
      },
      {
        name: "Static Bloom",
        slug: "static-bloom",
        bio: "Breaks and bass, no filler.",
        genres: ["breaks", "bass"],
        createdByUserId: alice.id,
      },
    ])
    .returning();

  const [event1] = await db
    .insert(events)
    .values([
      {
        name: "Midnight Frequencies",
        venue: "The Foundry",
        city: "Brooklyn, NY",
        eventDate: new Date("2026-06-14T23:00:00Z"),
        createdByUserId: alice.id,
      },
    ])
    .returning();

  const [review1, , review3] = await db
    .insert(reviews)
    .values([
      {
        userId: alice.id,
        djId: dj1.id,
        eventId: event1.id,
        ratingHalfStars: 9,
        reviewText: "Absolutely electric set, the buildup into the last hour was insane.",
        crowdVibe: "electric",
        crowdVibeNote: "Packed floor, everyone locked in.",
        seenAt: event1.eventDate,
      },
      {
        userId: bob.id,
        djId: dj2.id,
        ratingHalfStars: 7,
        reviewText: "Solid deep house groove, warmed up the room well.",
        crowdVibe: "good",
        seenAt: new Date("2026-05-01T22:00:00Z"),
      },
      {
        userId: bob.id,
        djId: dj3.id,
        ratingHalfStars: 8,
        reviewText: "Static Bloom's low end was unreal, floor was shaking all night.",
        crowdVibe: "electric",
        seenAt: new Date("2026-04-10T22:00:00Z"),
      },
    ])
    .returning();

  await db.insert(follows).values([
    { followerId: bob.id, followingId: alice.id },
  ]);

  await db.insert(reviewLikes).values([
    { reviewId: review1.id, userId: bob.id },
    { reviewId: review3.id, userId: alice.id },
  ]);

  await db.insert(reviewComments).values([
    { reviewId: review1.id, userId: bob.id, body: "Wish I was there for this one!" },
    { reviewId: review3.id, userId: alice.id, body: "Adding this to my list." },
  ]);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
