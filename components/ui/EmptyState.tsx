import { Text } from "./Text";

export function EmptyState({
  message,
  className = "mt-10 text-center text-paper/60",
}: {
  message: string;
  className?: string;
}) {
  return <Text className={className}>{message}</Text>;
}
