import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, router, usePathname } from "expo-router";
import { useColorScheme } from "nativewind";
import { useState } from "react";
import { Modal, Pressable, type PressableProps, View } from "react-native";

import { ROUTES } from "../lib/routes";
import { Button, Text } from "./ui";

function BrandWordmark() {
  return (
    <Link href={ROUTES.FEED} asChild>
      <Pressable>
        <Text className="font-display text-4xl text-primary dark:text-primary-dark">
          BeatBox&apos;d
        </Text>
      </Pressable>
    </Link>
  );
}

function SignInPromptModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-ink/40 px-6"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-paper dark:bg-surface-dark p-6 shadow-lg"
        >
          <Text className="mb-2 text-center text-xl font-display text-ink dark:text-paper">
            Sign in required
          </Text>
          <Text className="mb-5 text-center text-muted">
            Create an account or log in to do that.
          </Text>
          <View className="flex-row gap-3">
            <Button
              onPress={() => {
                onClose();
                router.push(ROUTES.SIGN_UP);
              }}
              className="flex-1 py-3"
            >
              <Text className="text-center font-semibold text-paper">Sign up</Text>
            </Button>
            <Pressable
              onPress={() => {
                onClose();
                router.push(ROUTES.SIGN_IN);
              }}
              className="flex-1 rounded-xl border border-primary/30 py-3 active:opacity-80"
            >
              <Text className="text-center font-semibold text-ink dark:text-paper">Log in</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} className="mt-4">
            <Text className="text-center text-muted">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ACTIVE_COLOR_LIGHT = "#7131B9";
const ACTIVE_COLOR_DARK = "#BA95E4";
const INACTIVE_COLOR = "#8a8a99";

// `path` is what usePathname() reports for the route (groups like (tabs)
// are stripped), used to highlight the active link.
const LINKS = [
  { href: ROUTES.FEED, path: "/feed", label: "Feed", icon: "home", gated: false },
  { href: ROUTES.BROWSE, path: "/browse", label: "Browse", icon: "search", gated: false },
  { href: ROUTES.LOG, path: "/log", label: "Log a Set", icon: "add-circle", gated: true },
  { href: ROUTES.PROFILE, path: "/profile", label: "Profile", icon: "person", gated: true },
] as const;

// Spreads the rest props onto Pressable so <Link asChild> can inject its
// href/onPress.
function NavItem({
  link,
  isActive = false,
  activeColor,
  ...pressableProps
}: {
  link: (typeof LINKS)[number];
  isActive?: boolean;
  activeColor?: string;
} & PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isActive ? { selected: true } : {}}
      {...pressableProps}
      className={`flex-row items-center gap-2 rounded-full px-4 py-2 active:opacity-80 ${
        isActive ? "bg-accent-tint dark:bg-accent/15" : ""
      }`}
    >
      <Ionicons name={link.icon} size={18} color={isActive ? activeColor : INACTIVE_COLOR} />
      <Text
        className={isActive ? "font-semibold text-accent-text dark:text-accent-dark" : "text-muted"}
      >
        {link.label}
      </Text>
    </Pressable>
  );
}

// Persistent web navbar. Used both as the (tabs) group's tabBar and as the
// root Stack's header, so every web page gets the same bar — it derives the
// active link from the URL rather than from tab navigator state so it works
// in either spot.
export function WebNav() {
  const { isSignedIn } = useAuth();
  const { colorScheme } = useColorScheme();
  const pathname = usePathname();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const activeColor = colorScheme === "dark" ? ACTIVE_COLOR_DARK : ACTIVE_COLOR_LIGHT;

  // Own background, not inherited: as the Stack header, React Navigation
  // wraps this in a container painted with its default (light) theme color.
  return (
    <View className="flex-row items-center justify-between border-b border-ink/10 bg-paper px-6 py-3 dark:border-paper/10 dark:bg-ink">
      <BrandWordmark />
      <View className="flex-row items-center gap-1">
        {LINKS.map((link) =>
          // Signed out, Log and Profile pop a sign-in/sign-up prompt
          // instead of navigating to a screen that would just redirect.
          !isSignedIn && link.gated ? (
            <NavItem key={link.label} link={link} onPress={() => setShowSignInPrompt(true)} />
          ) : (
            <Link key={link.label} href={link.href} asChild>
              <NavItem link={link} isActive={pathname === link.path} activeColor={activeColor} />
            </Link>
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
            <Button onPress={() => router.push(ROUTES.SIGN_UP)} className="px-4 py-1.5">
              <Text className="font-semibold text-paper">Sign up</Text>
            </Button>
          </View>
        ) : null}
      </View>
      <SignInPromptModal visible={showSignInPrompt} onClose={() => setShowSignInPrompt(false)} />
    </View>
  );
}
