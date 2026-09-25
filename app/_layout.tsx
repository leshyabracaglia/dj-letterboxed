import "../global.css";

import { ClerkProvider } from "@clerk/expo";
import { Jersey10_400Regular } from "@expo-google-fonts/jersey-10";
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Appearance, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { WebNav } from "../components/WebNav";
import { AuthProvider } from "../lib/auth";
import { tokenCache } from "../lib/clerk-token-cache";
import { getStoredThemePreference, resolveColorScheme } from "../lib/theme-storage";

SplashScreen.preventAutoHideAsync();

const publishableKey: string = (() => {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in your .env file.",
    );
  }
  return key;
})();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Jersey10_400Regular,
  });
  const [themeReady, setThemeReady] = useState(false);
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    // Re-reads the stored preference (rather than trusting local state) so
    // that a live OS appearance change only takes effect while the user's
    // choice is actually "system" — an explicit light/dark pick is a no-op.
    const applyPreference = async () => {
      const pref = (await getStoredThemePreference()) ?? "system";
      setColorScheme(resolveColorScheme(pref));
    };
    applyPreference().finally(() => setThemeReady(true));
    const sub = Appearance.addChangeListener(applyPreference);
    return () => sub.remove();
  }, [setColorScheme]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && themeReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, themeReady]);

  if ((!fontsLoaded && !fontError) || !themeReady) {
    return null;
  }

  const isDark = colorScheme === "dark";

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style={isDark ? "light" : "dark"} />
            <Stack
              screenOptions={{
                // Web gets the same persistent top nav as the tabs group
                // instead of a per-page native title bar with a back button —
                // native keeps the standard themed header, back chevron and all.
                header: Platform.OS === "web" ? () => <WebNav /> : undefined,
                headerStyle: { backgroundColor: isDark ? "#000000" : "#F6F6F9" },
                headerTintColor: isDark ? "#F6F6F9" : "#000000",
                headerTitleStyle: { fontFamily: "Roboto_700Bold" },
                headerBackTitleStyle: { fontFamily: "Roboto_400Regular" },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: isDark ? "#000000" : "#F6F6F9" },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
