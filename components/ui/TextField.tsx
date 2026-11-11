import { TextInput, type TextInputProps } from "react-native";

/** Placeholder color for text inputs on the wall (paper at 40%). */
const PLACEHOLDER_COLOR = "rgba(246,246,249,0.4)";

/** The app's text input: a dark panel with a paper border on focus.
 * `className` adds layout (margins, width, min-h for multiline). */
export function TextField({ className = "", ...props }: TextInputProps & { className?: string }) {
  // A line height on a single-line input pushes its text down on iOS and
  // clips descenders (g, p, y), so only multiline inputs get text-base's.
  const size = props.multiline ? "text-base" : "text-[16px]";
  return (
    <TextInput
      placeholderTextColor={PLACEHOLDER_COLOR}
      {...props}
      className={`rounded-md border-2 border-white/15 bg-zine-panel/90 px-4 py-3 ${size} text-paper focus:border-paper ${className}`}
    />
  );
}
