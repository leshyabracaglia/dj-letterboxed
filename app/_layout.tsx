import "../global.css";

import { ClerkProvider } from "@clerk/expo";
import { Jersey10_400Regular } from "@expo-google-fonts/jersey-10";
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import * as Application from "expo-application";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, type ReactNode } from "react";
import { AppState, Linking, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Button, Page, Text, useIsDesktopWeb } from "../components/ui";
import { WebNav } from "../components/WebNav";
import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { AppVersion } from "../lib/api/types";
import { AuthProvider } from "../lib/auth";
import { usePushNotifications } from "../lib/push";
import { tokenCache } from "../lib/clerk-token-cache";

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

// Navigators paint this behind every screen and header (and in any gap a
// screen doesn't cover, like over-scroll on web); without it they fall back
// to React Navigation's light-gray default theme.
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#000000", card: "#0B0809", border: "rgba(255,255,255,0.06)" },
};

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

// Hooks need a component inside AuthProvider; renders nothing.
function PushNotifications() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Jersey10_400Regular,
  });
  const { setColorScheme } = useColorScheme();
  const isDesktopWeb = useIsDesktopWeb();

  // The zine design (dark concrete wall, colored paper cards) only comes in
  // dark, so the dark: variants are always on.
  useEffect(() => {
    setColorScheme("dark");
  }, [setColorScheme]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PushNotifications />
            <StatusBar style="light" />
            <ThemeProvider value={NAV_THEME}>
            <ForceUpdateGate>
            <Stack
              screenOptions={{
                // Desktop web gets the same persistent top nav as the tabs group
                // instead of a per-page title bar; phone-width web and native keep
                // the standard themed header with a back chevron.
                header: isDesktopWeb ? () => <WebNav /> : undefined,
                headerStyle: { backgroundColor: "#0B0809" },
                headerTintColor: "#F6F6F9",
                headerTitleStyle: { fontFamily: "Jersey10_400Regular", fontSize: 24 },
                // Chevron only: the default back title is the previous route's
                // name, which for anything pushed from the tabs reads "(tabs)".
                // (A custom headerBackTitleStyle font forces a static title, so
                // none is set.)
                headerBackButtonDisplayMode: "minimal",
                headerShadowVisible: false,
                contentStyle: { backgroundColor: "#000000" },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
            </ForceUpdateGate>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
