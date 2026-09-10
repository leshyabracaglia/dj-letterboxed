import { router } from "../trpc";
import { djsRouter } from "./djs";
import { eventsRouter } from "./events";
import { feedRouter } from "./feed";
import { followsRouter } from "./follows";
import { reviewsRouter } from "./reviews";
import { usersRouter } from "./users";

export const appRouter = router({
  users: usersRouter,
  djs: djsRouter,
  events: eventsRouter,
  reviews: reviewsRouter,
  follows: followsRouter,
  feed: feedRouter,
});

export type AppRouter = typeof appRouter;
