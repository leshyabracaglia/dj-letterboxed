import type { Href } from "expo-router";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable } from "react-native";

export function Card({ href, children }: { href: Href; children: ReactNode }) {
  return (
    <Link href={href} asChild>
      <Pressable className="mb-3 rounded-xl border border-muted/20 bg-white p-4">
        {children}
      </Pressable>
    </Link>
  );
}
