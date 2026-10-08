import { useState } from "react";
import { View } from "react-native";

import { Text } from "./Text";

// Uppercase Jersey 10 advance widths, in ems (measured from the font): most
// letters are ~0.42em, M and W run wider. Used to estimate a word's width
// without rendering it, which works the same on native and web.
const WIDE = /[MW]/;
const NARROW = /[I1.,'·:;!| ]/;
function emWidth(word: string): number {
  let w = 0;
  for (const ch of word.toUpperCase()) w += WIDE.test(ch) ? 0.59 : NARROW.test(ch) ? 0.2 : 0.43;
  return w;
}

/** A big uppercase display heading that keeps its size, unless its longest
 * single word wouldn't fit on one line at that size (a long one-word DJ
 * name) - then it steps down just enough for that word to fit, instead of
 * breaking it mid-word. Multi-word names still wrap normally at full size.
 * `className` sets color/margins; size comes from `fontSize`. */
export function FitText({
  children,
  fontSize,
  minFontSize = fontSize * 0.5,
  lineHeightRatio = 0.94,
  numberOfLines,
  className = "",
}: {
  children: string;
  fontSize: number;
  minFontSize?: number;
  lineHeightRatio?: number;
  numberOfLines?: number;
  className?: string;
}) {
  const [width, setWidth] = useState(0);
  const longest = Math.max(...children.split(/\s+/).map(emWidth), 0.01);
  // 4% slack for rounding and the font's side bearings.
  const fitting = width ? Math.min(fontSize, (width * 0.96) / longest) : fontSize;
  const size = Math.max(minFontSize, Math.floor(fitting));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text
        className={`font-display uppercase ${className}`}
        style={{ fontSize: size, lineHeight: Math.round(size * lineHeightRatio) }}
        numberOfLines={numberOfLines}
      >
        {children}
      </Text>
    </View>
  );
}
