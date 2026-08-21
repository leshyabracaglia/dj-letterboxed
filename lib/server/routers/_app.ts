import { router } from "../trpc";
import { djsRouter } from "./djs";
import { eventsRouter } from "./events";
import { feedRouter } from "./feed";
import { followsRouter } from "./follows";
import { logsRouter } from "./logs";
import { usersRouter } from "./users";

export const appRouter = router({
  users: usersRouter,
  djs: djsRouter,
  events: eventsRouter,
  logs: logsRouter,
  follows: followsRouter,
  feed: feedRouter,
});

export type AppRouter = typeof appRouter;
