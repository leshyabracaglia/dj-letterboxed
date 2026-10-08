import { useAuth } from "@clerk/expo";
import { Link, router, usePathname } from "expo-router";
import { useState } from "react";
import { Pressable, type PressableProps, View } from "react-native";

import { ROUTES } from "../lib/routes";
import { BrandWordmark } from "./BrandWordmark";
import { SignInPromptModal } from "./SignInPromptModal";
import { GlowBar, Text } from "./ui";

function HomeLink() {
  return (
    <Link href={ROUTES.FEED} asChild>
      <Pressable>
        <BrandWordmark compact />
      </Pressable>
    </Link>
  );
}

// `path` is what usePathname() reports for the route (groups like (tabs)
// are stripped), used to highlight the active link. Same order and labels
// as the phone tab bar (app/(tabs)/_layout.tsx); `isLog` is its white key.
const LINKS = [
  { href: ROUTES.FEED, path: "/feed", label: "Feed", gated: false, isLog: false },
  { href: ROUTES.BROWSE, path: "/browse", label: "Browse", gated: false, isLog: false },
  { href: ROUTES.REVIEW, path: "/review", label: "Log +", gated: true, isLog: true },
  { href: ROUTES.PROFILE, path: "/profile", label: "Profile", gated: true, isLog: false },
] as const;

// A white raised key with dark pixel type ("LOG +", "SIGN UP").
function KeyLabel({ label }: { label: string }) {
  return (
    <View className="rounded-xl bg-paper px-5 py-2 shadow-lg shadow-white/30">
      <Text className="font-display text-xl uppercase leading-6 text-ink">{label}</Text>
    </View>
  );
}

// Spreads the rest props onto Pressable so <Link asChild> can inject its
// href/onPress.
function NavItem({
  link,
  isActive = false,
  ...pressableProps
}: {
  link: (typeof LINKS)[number];
  isActive?: boolean;
} & PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isActive ? { selected: true } : {}}
      {...pressableProps}
      className="items-center px-4 py-1 active:opacity-80"
    >
      {link.isLog ? (
        <KeyLabel label={link.label} />
      ) : (
        <>
          <GlowBar active={isActive} className="mb-1.5" />
          <Text
            className={`font-display text-xl uppercase leading-6 ${isActive ? "text-paper" : "text-paper/55"}`}
          >
            {link.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// Persistent web navbar. Used both as the (tabs) group's tabBar and as the
// root Stack's header, so every web page gets the same bar — it derives the
// active link from the URL rather than from tab navigator state so it works
// in either spot.
export function WebNav() {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Own background, not inherited: as the Stack header, React Navigation
  // wraps this in a container painted with its theme's card color.
  return (
    <View className="flex-row items-center justify-between border-b border-white/5 bg-black/95 px-8 py-3">
      <HomeLink />
      <View className="flex-row items-center gap-2">
        {LINKS.map((link) =>
          // Signed out, Log + and Profile pop a sign-in/sign-up prompt
          // instead of navigating to a screen that would just redirect.
          !isSignedIn && link.gated ? (
            <NavItem key={link.label} link={link} onPress={() => setShowSignInPrompt(true)} />
          ) : (
            <Link key={link.label} href={link.href} asChild>
              <NavItem link={link} isActive={pathname === link.path} />
            </Link>
          ),
        )}
        {!isSignedIn && (
          <View className="ml-4 flex-row items-center gap-3">
            <Pressable
              onPress={() => router.push(ROUTES.SIGN_IN)}
              className="rounded-xl border-2 border-paper/60 px-4 py-1.5 active:opacity-80"
            >
              <Text className="font-display text-xl uppercase leading-6 text-paper">Log in</Text>
            </Pressable>
            <Pressable onPress={() => router.push(ROUTES.SIGN_UP)} className="active:opacity-80">
              <KeyLabel label="Sign up" />
            </Pressable>
          </View>
        )}
      </View>
      <SignInPromptModal visible={showSignInPrompt} onClose={() => setShowSignInPrompt(false)} />
    </View>
  );
}
