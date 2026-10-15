import { Stack } from "expo-router";

import { MissingState } from "../components/DetailPage";
import { Page } from "../components/ui";

export default function NotFoundScreen() {
  return (
    <Page>
      <Stack.Screen options={{ title: "Not found" }} />
      <MissingState message="This page doesn't exist." />
    </Page>
  );
}
