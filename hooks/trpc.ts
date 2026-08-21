import { useMemo } from "react";
import { useAuth } from "@clerk/expo";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "../lib/server/routers/_app";

export const queryClient = new QueryClient();

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export function useCreateTRPCClient() {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      createTRPCClient<AppRouter>({
        links: [
          httpBatchLink({
            url: `${apiUrl}/api/trpc`,
            transformer: superjson,
            async headers() {
              const token = await getToken();
              return token ? { authorization: `Bearer ${token}` } : {};
            },
          }),
        ],
      }),
    [getToken],
  );
}
