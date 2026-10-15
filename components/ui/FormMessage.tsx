import { Text } from "./Text";

const MESSAGE_TONE = {
  ERROR: "error",
  SUCCESS: "success",
};

type MessageTone = (typeof MESSAGE_TONE)[keyof typeof MESSAGE_TONE];

const MESSAGE_TONE_TO_TEXT_CLASS = {
  [MESSAGE_TONE.ERROR]: "text-danger-dark",
  [MESSAGE_TONE.SUCCESS]: "text-success-dark",
} as const;

/** A form's error or confirmation line. Renders nothing without children,
 * so `<FormMessage>{error}</FormMessage>` needs no guard. */
export function FormMessage({
  tone = MESSAGE_TONE.ERROR,
  children,
}: {
  tone?: MessageTone;
  children?: string | null | false | undefined;
}) {
  if (!children) return null;
  return <Text className={`${MESSAGE_TONE_TO_TEXT_CLASS[tone]} mb-3`}>{children}</Text>;
}
