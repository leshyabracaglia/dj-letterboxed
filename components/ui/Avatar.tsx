import * as AvatarPrimitive from "@rn-primitives/avatar";

import { Text } from "./Text";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const second = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? "");
  return (first + second).toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  return (
    // Rounded square; the corner radius scales with size so small and large
    // avatars share the same shape. overflow-hidden clips image + fallback.
    <AvatarPrimitive.Root
      alt={name}
      className="relative shrink-0 overflow-hidden"
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    >
      {uri ? <AvatarPrimitive.Image source={{ uri }} className="aspect-square size-full" /> : null}
      <AvatarPrimitive.Fallback className="size-full items-center justify-center bg-accent">
        <Text className="font-semibold text-center text-white" style={{ fontSize: size * 0.4 }}>
          {initialsFor(name)}
        </Text>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
