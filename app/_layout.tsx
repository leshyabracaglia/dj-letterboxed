import "../global.css";

import { ClerkProvider } from "@clerk/expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { TRPCProvider, queryClient, useCreateTRPCClient } from "../hooks/trpc";
import { tokenCache } from "../lib/clerk-token-cache";

const publishableKey: string = (() => {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in your .env file.",
    );
  }
  return key;
})();

function Providers({ children }: { children: React.ReactNode }) {
  const trpcClient = useCreateTRPCClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <SafeAreaProvider>
        <Providers>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack>
        </Providers>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
