import "@/global.css";

import { ClerkProvider } from "@clerk/expo";
import { Jersey10_400Regular } from "@expo-google-fonts/jersey-10";
import { PermanentMarker_400Regular } from "@expo-google-fonts/permanent-marker";
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import * as Application from "expo-application";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Linking, Pressable, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Icon, Page, Text, useIsDesktopWeb } from "@/components/ui";
import { WebNav } from "@/components/WebNav";
import { WHATS_NEW_VERSION, WhatsNewSheet } from "@/components/WhatsNewSheet";
import { ApiError, useApi, unwrap } from "@/lib/api/client";
import { Analytics } from "@/lib/analytics";
import { useSettings, useUpdateSettings } from "@/lib/api/hooks";
import { queryKeys } from "@/lib/api/queryKeys";
import { AuthProvider, useCurrentUser } from "@/lib/auth";
import { usePushNotifications } from "@/lib/push";
import { tokenCache } from "@/lib/clerk-token-cache";
import { isIos } from "@/lib/platform";
import { colors } from "@/lib/colors";
import { needsOnboarding } from "@/lib/user";

SplashScreen.preventAutoHideAsync();

const publishableKey: string = (() => {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in your .env file.");
  }
  return key;
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx (a deleted review, a mistyped link) won't change on retry, so
      // fail at once and let the screen say so; retry network and 5xx errors.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 3,
    },
  },
});

// Navigators paint this behind every screen and header (and in any gap a
// screen doesn't cover, like over-scroll on web); without it they fall back
// to React Navigation's light-gray default theme.
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ink, card: colors.chrome, border: "rgba(255,255,255,0.06)" },
};

// iOS build number of this binary (CFBundleVersion); null on web/Android.
const iosBuild = isIos ? Number(Application.nativeBuildVersion) : NaN;

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
    queryFn: () => unwrap(api.GET("/api/app-version")),
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
        <Button onPress={() => Linking.openURL(data.iosUpdateUrl)} className="mt-4 w-full max-w-sm py-3">
          <Text className="text-center font-semibold text-paper">Open TestFlight</Text>
        </Button>
      </View>
    </Page>
  );
}

// How long the splash screen waits for sign-in to load before giving way
// anyway (offline, a slow network): the screens have their own loading
// states from there.
const SPLASH_MAX_MS = 4000;

// Keeps the splash screen up until we know whether someone's signed in, so
// launching goes straight from the splash to the app instead of through a
// blank screen. Rendered once the fonts are in; renders nothing.
function HideSplashWhenReady() {
  const { isLoaded } = useCurrentUser();
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync(), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (isLoaded) SplashScreen.hideAsync();
  }, [isLoaded]);
  return null;
}

// Hooks need a component inside AuthProvider; renders nothing.
function PushNotifications() {
  usePushNotifications();
  return null;
}

// Shows the "What's new" sheet once per account (on whichever device opens
// the new build first) to a set-up user who hasn't closed this version yet.
function WhatsNew() {
  const { me, isSignedIn } = useCurrentUser();
  const settings = useSettings(isSignedIn && !!me && !needsOnboarding(me.username));
  const update = useUpdateSettings();
  const [closed, setClosed] = useState(false);

  if (closed || !settings.data || settings.data.whatsNewSeen >= WHATS_NEW_VERSION) return null;
  return (
    <WhatsNewSheet
      onClose={() => {
        setClosed(true);
        update.mutate({ whatsNewSeen: WHATS_NEW_VERSION });
      }}
    />
  );
}

// What the stack hands a custom header: the screen's options (its title)
// and whether there's a screen to go back to.
type StackHeaderProps = {
  navigation: { goBack: () => void };
  options: { title?: string };
  back?: unknown;
};

// The bar over every pushed screen: a back chevron (when there's somewhere
// to go back to) and the screen's title beside it, on the chrome color.
function StackHeader({ navigation, options, back }: StackHeaderProps) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top, backgroundColor: colors.chrome }}>
      <View className="h-12 flex-row items-center gap-1 px-2">
        {!!back && (
          <Pressable
            onPress={navigation.goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="p-1.5 active:opacity-70"
          >
            <Icon name="chevron-back" size={24} className="text-paper" />
          </Pressable>
        )}
        <Text
          variant="display"
          accessibilityRole="header"
          className={`flex-1 text-2xl text-paper ${back ? "" : "pl-2"}`}
          numberOfLines={1}
        >
          {options.title ?? ""}
        </Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Jersey10_400Regular,
    PermanentMarker_400Regular,
  });
  const { setColorScheme } = useColorScheme();
  const isDesktopWeb = useIsDesktopWeb();

  // The zine design (dark concrete wall, colored paper cards) only comes in
  // dark. Style for it directly - don't add light/dark class pairs.
  useEffect(() => {
    setColorScheme("dark");
  }, [setColorScheme]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <HideSplashWhenReady />
            <PushNotifications />
            <Analytics />
            <StatusBar style="light" />
            <ThemeProvider value={NAV_THEME}>
              <ForceUpdateGate>
                <Stack
                  screenOptions={{
                    // Desktop web gets the same persistent top nav as the tabs group
                    // instead of a per-page title bar; phone-width web and native get
                    // our own bar, a back chevron with the title left-aligned beside
                    // it (iOS's native bar always centers the title).
                    header: isDesktopWeb ? () => <WebNav /> : (props: StackHeaderProps) => <StackHeader {...props} />,
                    contentStyle: { backgroundColor: colors.ink },
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                </Stack>
                <WhatsNew />
              </ForceUpdateGate>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
