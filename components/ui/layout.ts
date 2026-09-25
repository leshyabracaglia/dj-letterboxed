import { useWindowDimensions, type ViewStyle } from "react-native";

// Horizontal page gutter. Wider once the viewport stops being phone-sized
// (tablets, desktop web) so content doesn't hug the window edges.
const GUTTER = { compact: 24, wide: 400 } as const;
const WIDE_BREAKPOINT = 768;

export function usePageGutter(): number {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT ? GUTTER.wide : GUTTER.compact;
}

// For a FlatList/ScrollView's contentContainerStyle, so the scroll area
// itself stays full-width (scrollbar at the window edge, card shadows not
// clipped) while its content lines up with the page gutter.
export function usePageContentStyle(): ViewStyle {
  const gutter = usePageGutter();
  return { paddingHorizontal: gutter, paddingVertical: 16 };
}
