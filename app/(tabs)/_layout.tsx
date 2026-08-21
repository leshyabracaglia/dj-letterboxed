import { useAuth } from "@clerk/expo";
import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text className={focused ? "text-accent" : "text-muted"} style={{ fontSize: 12 }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      initialRouteName="feed"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ff5470",
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ focused }) => <TabIcon label="FEED" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          tabBarIcon: ({ focused }) => <TabIcon label="BROWSE" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log a Set",
          tabBarIcon: ({ focused }) => <TabIcon label="LOG" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon label="YOU" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
