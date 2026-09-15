import { Text } from "react-native";

export function EmptyState({
  message,
  className = "mt-10 text-center text-muted",
}: {
  message: string;
  className?: string;
}) {
  return <Text className={className}>{message}</Text>;
}
