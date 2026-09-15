import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { ColorValue, Platform } from "react-native";

import { WebTabBar } from "../../components/WebTabBar";
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
  const api = useApi();

  const { data: me } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<User>("/users/me"),
    enabled: !!isSignedIn,
  });

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href={ROUTES.SIGN_IN} />;
  }

  if (needsOnboarding(me?.username)) {
    return <Redirect href={ROUTES.ONBOARDING} />;
  }

  return (
    <Tabs
      initialRouteName="feed"
      // Bottom tabs read as a mobile pattern; on web, a horizontal navbar reads better.
      tabBar={Platform.OS === "web" ? (props) => <WebTabBar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: Platform.OS === "web" ? "top" : "bottom",
        tabBarActiveTintColor: "#884ACF",
        tabBarInactiveTintColor: "#8a8a99",
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
