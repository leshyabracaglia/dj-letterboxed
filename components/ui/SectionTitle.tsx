import { Text } from "./Text";

export function SectionTitle({ children }: { children: string }) {
  return <Text className={`font-display text-2xl uppercase text-paper/85`}>{children}</Text>;
}
