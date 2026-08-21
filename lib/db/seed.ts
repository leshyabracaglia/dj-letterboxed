import { db } from "./client";
import { djs, events, follows, logs, users } from "./schema";

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

  const [dj1, dj2] = await db
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

  await db.insert(logs).values([
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
  ]);

  await db.insert(follows).values([
    { followerId: bob.id, followingId: alice.id },
  ]);

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
