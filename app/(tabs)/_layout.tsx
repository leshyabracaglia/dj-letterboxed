import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useSegments } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useColorScheme } from "nativewind";
import { ColorValue, Platform } from "react-native";

import { WebNav } from "../../components/WebNav";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { User } from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";
import { needsOnboarding } from "../../lib/user";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  name,
  color,
  size,
}: {
  name: IoniconName;
  color: ColorValue;
  size: number;
}) {
  return <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const api = useApi();
  const segments = useSegments();
  // Browse (DJ search) and Feed (falls back to Popular without a following
  // graph) work without an account; Log and Profile redirect to sign-in.
  const activeTab = segments[segments.length - 1];
  const isPublicTab = activeTab === "browse" || activeTab === "feed";

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
    enabled: !!isSignedIn,
  });

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn && !isPublicTab) {
    return <Redirect href={ROUTES.SIGN_IN} />;
  }

  if (isSignedIn && needsOnboarding(me?.username)) {
    return <Redirect href={ROUTES.ONBOARDING} />;
  }

  return (
    <Tabs
      initialRouteName="feed"
      // Bottom tabs read as a mobile pattern; on web, a horizontal navbar reads better.
      tabBar={Platform.OS === "web" ? () => <WebNav /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: Platform.OS === "web" ? "top" : "bottom",
        tabBarActiveTintColor: isDark ? "#BA95E4" : "#7131B9",
        tabBarInactiveTintColor: "#8a8a99",
        tabBarStyle: {
          backgroundColor: isDark ? "#1A1624" : "#F6F6F9",
          borderTopColor: isDark ? "rgba(246,246,249,0.1)" : "rgba(18,18,26,0.1)",
        },
        tabBarLabelStyle: { fontFamily: "Roboto_500Medium" },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <TabIcon name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log a Set",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="add-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <TabIcon name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
