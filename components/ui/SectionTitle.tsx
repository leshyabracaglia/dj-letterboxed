import { Text } from "./Text";

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="display" className="text-2xl text-paper/85">
      {children}
    </Text>
  );
}
