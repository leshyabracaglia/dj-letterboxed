import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./Text";

import { ROUTES } from "../lib/routes";
import { BrandWordmark } from "./BrandWordmark";
import { MetalButton } from "./MetalButton";
import { SignInPromptModal } from "./SignInPromptModal";

const LINKS = [
  { href: ROUTES.FEED, label: "Feed", icon: "home" as const, gated: false },
  { href: ROUTES.BROWSE, label: "Browse", icon: "search" as const, gated: false },
  { href: ROUTES.LOG, label: "Log a Set", icon: "add-circle" as const, gated: true },
  { href: ROUTES.PROFILE, label: "Profile", icon: "person" as const, gated: true },
];

// Persistent top header for web-only, used for routes pushed on the root
// Stack (DJ/event/user/log/settings pages, plus the signed-out landing page)
// rather than the (tabs) group — those already get WebTabBar as their Tabs
// `tabBar`. There's no single "active" tab to highlight here since these
// pages aren't part of any one tab, so every link renders the same
// (unhighlighted) way. Signed out, Browse and Feed are reachable (Feed
// just falls back to Popular) — Log and Profile pop a sign-in/sign-up
// prompt instead of navigating.
export function TopNav() {
  const { isSignedIn } = useAuth();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  return (
    <View className="flex-row items-center justify-between border-b border-ink/10 px-6 py-3 dark:border-paper/10">
      <BrandWordmark />
      <View className="flex-row items-center gap-1">
        {LINKS.map((link) =>
          isSignedIn || !link.gated ? (
            <Link key={link.label} href={link.href} asChild>
              <Pressable className="flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-80">
                <Ionicons name={link.icon} size={18} color="#8a8a99" />
                <Text className="text-muted">{link.label}</Text>
              </Pressable>
            </Link>
          ) : (
            <Pressable
              key={link.label}
              onPress={() => setShowSignInPrompt(true)}
              className="flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-80"
            >
              <Ionicons name={link.icon} size={18} color="#8a8a99" />
              <Text className="text-muted">{link.label}</Text>
            </Pressable>
          ),
        )}
        {!isSignedIn ? (
          <View className="ml-2 flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push(ROUTES.SIGN_IN)}
              className="rounded-full border border-primary/30 px-4 py-1.5 active:opacity-80"
            >
              <Text className="font-semibold text-ink dark:text-paper">Log in</Text>
            </Pressable>
            <MetalButton
              onPress={() => router.push(ROUTES.SIGN_UP)}
              className="rounded-full px-4 py-1.5"
            >
              <Text className="font-semibold text-paper">Sign up</Text>
            </MetalButton>
          </View>
        ) : null}
      </View>
      <SignInPromptModal visible={showSignInPrompt} onClose={() => setShowSignInPrompt(false)} />
    </View>
  );
}
