import { Page } from "./Page";
import { Text } from "./Text";

export function ScreenLoading() {
  return (
    <Page className="items-center justify-center">
      <Text className="text-muted">Loading...</Text>
    </Page>
  );
}
