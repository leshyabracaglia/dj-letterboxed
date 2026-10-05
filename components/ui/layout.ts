import { Platform, useWindowDimensions, type ViewStyle } from "react-native";

// Horizontal page gutter. Content is capped at MAX_CONTENT_WIDTH: on wide
// viewports (tablets, desktop web) the gutter grows to center it, while
// narrower ones keep the fixed minimum rather than squeezing the content.
const MIN_GUTTER = 24;
const MAX_CONTENT_WIDTH = 680;
const WIDE_BREAKPOINT = 768;

export function usePageGutter(): number {
  const { width } = useWindowDimensions();
  return Math.max(MIN_GUTTER, (width - MAX_CONTENT_WIDTH) / 2);
}

// For a FlatList/ScrollView's contentContainerStyle, so the scroll area
// itself stays full-width (scrollbar at the window edge, card shadows not
// clipped) while its content lines up with the page gutter.
export function usePageContentStyle(): ViewStyle {
  const gutter = usePageGutter();
  return { paddingHorizontal: gutter, paddingVertical: 16 };
}

// The top WebNav only fits a desktop-width browser; phone-sized web gets the
// same bottom tab bar and native-style stack header as the apps.
export function useIsDesktopWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= WIDE_BREAKPOINT;
}
