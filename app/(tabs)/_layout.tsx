import { Redirect, useSegments } from "expo-router";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { SignInPromptModal } from "../../components/SignInPromptModal";
import { GlowBar, Text, useIsDesktopWeb } from "../../components/ui";
import { WebNav } from "../../components/WebNav";
import { useCurrentUser } from "../../lib/auth";
import { ROUTES } from "../../lib/routes";
import { needsOnboarding } from "../../lib/user";


const TAB_LABELS: Record<string, string> = {
  feed: "Feed",
  browse: "Browse",
  review: "Log +",
  profile: "Profile",
};

// The phone tab bar from the zine mockups: pixel-type labels with a short
// glowing bar over the active one, and Log + as a raised white key.
function ZineTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View
      className="flex-row items-center border-t border-white/5 bg-black/95 px-3 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const isLog = route.name === "review";
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={descriptors[route.key].options.title ?? TAB_LABELS[route.name]}
            className="flex-1 items-center active:opacity-80"
          >
            {isLog ? (
              <View
                className="rounded-xl bg-paper px-5 py-3"
                style={{ boxShadow: "0 0 14px 1px rgba(246,246,249,0.3)" }}
              >
                <Text className="font-display text-xl uppercase leading-6 text-ink">{TAB_LABELS[route.name]}</Text>
              </View>
            ) : (
              <>
                <GlowBar active={isFocused} className="mb-2" />
                <Text
                  className={`font-display text-lg uppercase leading-5 ${
                    isFocused ? "text-paper" : "text-paper/55"
                  }`}
                >
                  {TAB_LABELS[route.name]}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { me, isSignedIn, isLoaded } = useCurrentUser();
  const segments = useSegments();
  const isDesktopWeb = useIsDesktopWeb();
  // Browse (DJ search) and Feed (falls back to Popular without a following
  // graph) work without an account; Review and Profile redirect to sign-in.
  // This layout stays mounted under screens pushed over the tabs (a review,
  // a DJ page), so only gate while a tab is the current route — otherwise
  // opening /review/[id] signed out would swap the tabs for sign-in
  // underneath it, and back would land there instead of the feed.
  const onTab = segments[0] === "(tabs)";
  const activeTab = segments[segments.length - 1];
  const isPublicTab = !onTab || activeTab === "browse" || activeTab === "feed";
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  const gatedTabListeners = isSignedIn
    ? undefined
    : {
        tabPress: (e: { preventDefault: () => void }) => {
          e.preventDefault();
          setShowSignInPrompt(true);
        },
      };

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
    <>
    <Tabs
      initialRouteName="feed"
      tabBar={isDesktopWeb ? () => <WebNav /> : (props) => <ZineTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktopWeb ? "top" : "bottom",
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
        }}
      />
      <Tabs.Screen
        name="review"
        listeners={gatedTabListeners}
        options={{
          title: "Review a Set",
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={gatedTabListeners}
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
    <SignInPromptModal visible={showSignInPrompt} onClose={() => setShowSignInPrompt(false)} />
    </>
  );
}
