import { Text } from "./Text";

export function EmptyState({ message }: { message: string }) {
  return <Text className="text-center text-paper/60">{message}</Text>;
}
