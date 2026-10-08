import { Image, View } from "react-native";

import { Icon } from "./Icon";

/** A square-cornered photo, or a silhouette placeholder when there's no
 * image. `framed` gives it the white snapshot border and a slight tilt, like
 * a print taped to a card. */
export function Photo({
  uri,
  width,
  height = width,
  framed = false,
  rotate = 0,
  placeholderClassName = "bg-[#3B0E14]",
  silhouetteClassName = "text-zine-red",
}: {
  uri?: string | null;
  // Omit both to fill the parent (size the parent instead).
  width?: number;
  height?: number;
  framed?: boolean;
  rotate?: number;
  placeholderClassName?: string;
  silhouetteClassName?: string;
}) {
  return (
    <View
      className={`${framed ? "border-4 border-paper shadow-lg shadow-black/50" : ""} overflow-hidden`}
      style={{
        width: width ?? "100%",
        height: height ?? "100%",
        transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <View className={`flex-1 items-center justify-end overflow-hidden ${placeholderClassName}`}>
          <Icon name="person" size={width && height ? Math.min(width, height) * 0.95 : 88} className={silhouetteClassName} />
        </View>
      )}
    </View>
  );
}
