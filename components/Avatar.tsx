import { Image, View } from "react-native";
import { Text } from "./Text";

const PALETTE = ["#884ACF", "#3a86ff", "#8338ec", "#06d6a0", "#ffbe0b", "#fb5607"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

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
  if (uri) {
    return (
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorFor(name || "?"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text className="font-semibold text-center" style={{ color: "white", fontSize: size * 0.4 }}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}
