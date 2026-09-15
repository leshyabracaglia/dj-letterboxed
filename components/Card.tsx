import type { Href } from "expo-router";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable } from "react-native";

const TINTS = {
  neutral: "border-muted/15 bg-white dark:border-paper/10 dark:bg-surface-dark",
  primary: "border-primary/25 bg-primary/5 dark:border-primary/40 dark:bg-primary/10",
  accent: "border-accent/25 bg-accent/5 dark:border-accent/40 dark:bg-accent/10",
};

export function Card({
  href,
  tint = "neutral",
  children,
}: {
  href: Href;
  tint?: keyof typeof TINTS;
  children: ReactNode;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        className={`mb-3 rounded-2xl border p-4 shadow-sm active:opacity-90 ${TINTS[tint]}`}
      >
        {children}
      </Pressable>
    </Link>
  );
}
