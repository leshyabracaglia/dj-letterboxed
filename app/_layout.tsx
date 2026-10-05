import "../global.css";

import { ClerkProvider } from "@clerk/expo";
import { Jersey10_400Regular } from "@expo-google-fonts/jersey-10";
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import * as Application from "expo-application";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Appearance, Linking, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Button, Page, Text, useIsDesktopWeb } from "../components/ui";
import { WebNav } from "../components/WebNav";
import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { AppVersion } from "../lib/api/types";
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

// iOS build number of this binary (CFBundleVersion); null on web/Android.
const iosBuild = Platform.OS === "ios" ? Number(Application.nativeBuildVersion) : NaN;

// Blocks the app behind an "update required" screen when this iOS build is
// older than the server's minimum (minIOSBuild in
// server/internal/httpapi/app_version_handlers.go). Re-checks whenever the
// app returns to the foreground, so a backgrounded app still gets caught.
// Fails open: if the check errors, the app stays usable.
function ForceUpdateGate({ children }: { children: ReactNode }) {
  const api = useApi();
  const enabled = Number.isFinite(iosBuild);
  const { data, refetch } = useQuery({
    queryKey: queryKeys.appVersion(),
    queryFn: () => api.get<AppVersion>("/app-version"),
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refetch();
    });
    return () => sub.remove();
  }, [enabled, refetch]);

  if (!data || iosBuild >= data.minIosBuild) return children;

  return (
    <Page>
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <Text className="text-center text-2xl font-bold">Update required</Text>
        <Text className="text-center text-muted">
          A new version of BeatBox&apos;d is available. Update in TestFlight to keep using the app.
        </Text>
        <Button
          onPress={() => Linking.openURL(data.iosUpdateUrl)}
          className="mt-4 w-full max-w-sm py-3"
        >
          <Text className="text-center font-semibold text-paper">Open TestFlight</Text>
        </Button>
      </View>
    </Page>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Jersey10_400Regular,
  });
  const [themeReady, setThemeReady] = useState(false);
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDesktopWeb = useIsDesktopWeb();

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
            <ForceUpdateGate>
            <Stack
              screenOptions={{
                // Desktop web gets the same persistent top nav as the tabs group
                // instead of a per-page title bar; phone-width web and native keep
                // the standard themed header with a back chevron.
                header: isDesktopWeb ? () => <WebNav /> : undefined,
                headerStyle: { backgroundColor: isDark ? "#000000" : "#F6F6F9" },
                headerTintColor: isDark ? "#F6F6F9" : "#000000",
                headerTitleStyle: { fontFamily: "Roboto_700Bold" },
                // Chevron only: the default back title is the previous route's
                // name, which for anything pushed from the tabs reads "(tabs)".
                // (A custom headerBackTitleStyle font forces a static title, so
                // none is set.)
                headerBackButtonDisplayMode: "minimal",
                headerShadowVisible: false,
                contentStyle: { backgroundColor: isDark ? "#000000" : "#F6F6F9" },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
            </ForceUpdateGate>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
